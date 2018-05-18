const xml2js = require('xml2js')
const moment = require('moment')
const uuidv4 = require('uuid/v4')

const Assignment = require('./assignment')
var MongoClient = require('mongodb').MongoClient;

class AssignmentChecker {
  constructor (mturk, config) {
    this.mturk = mturk
    this.config = config
  }

  xmlToJson (data) {
    return new Promise((resolve, reject) => {
      xml2js.parseString(data, {
        explicitArray: false,
        explicitRoot: false
      }, (err, data) => {
        if (err) {
          return reject(err)
        }
        resolve(data)
      })
    })
  }

  // We're good to go now
  async setupMongoClient (config) {
    if (!config) {
      config = this.config.mongodb
    }
    const mongoClient = await MongoClient.connect(config.url)
    const db = await mongoClient.db(config.database)
    this.mongoClient = mongoClient
    this.db = db
  }

  async getAssignmentsForHIT (hitId) {
    const self = this
    const result = await this.mturk.listAssignmentsForHIT({
      HITId: hitId,
      AssignmentStatuses: ['Submitted']
    })
    if (!result.Assignments) {
      console.log(`keys=${JSON.stringify(Object.keys(result))}`)
      return []
    }
    const promises = result.Assignments.map(async (assignment) => {
      const json = await self.xmlToJson(assignment.Answer)
      assignment.Answer = json
      return assignment
    })
    return Promise.all(promises)
  }

  async getAllAssignmentsForHITs (hitIds) {
    const self = this
    var promises = hitIds.map(async (hitId) => {
      return await self.getAssignmentsForHIT(hitId)
    })
    const assignmentArrays = await Promise.all(promises)
    const rawAssignments = [].concat.apply([], ...assignmentArrays)
    const assignments = []
    rawAssignments.forEach((rawAssignment) => {
      // Since users can submit multiple experiment IDs, split experimentID by comma
      // console.log(`rawAssignment: ${JSON.stringify(rawAssignment, null, 2)}`)
      // const answers = rawAssignment.Answer.Answer
      // const exptIDField = answers.filter(e => e.QuestionIdentifier === 'experimentID')[0]
      // const experimentIDs = exptIDField.FreeText.split(',')
      // experimentIDs.forEach((exptID) => {
      //   const exptAnswer = JSON.parse(JSON.stringify(rawAssignment))
      //   const exptIDField = exptAnswer.Answer.Answer.filter(e => e.QuestionIdentifier === 'experimentID')[0]
      //   exptIDField.FreeText = exptID
      //   const assignment = new Assignment(exptAnswer)
      //   assignments.push(assignment)
      // })
      assignments.push(new Assignment(rawAssignment))
    })
    return assignments
  }

  async validateAssignment (assignment, db) {
    console.log(JSON.stringify(assignment, null, 2))
    const experimentIDs = assignment.experimentIDs
    const collection = await this.db.collection('results')
    const results = {}
    const promises = experimentIDs.map(async (experimentID) => {
      const mongoDoc = await collection.findOne({type: 'expt-data', experimentID: experimentID})
      if (!mongoDoc || mongoDoc.experimentID !== experimentID) {
        return results[experimentID] = {
          doc: mongoDoc,
          error: new Error('Experiment not found')
        }
      }
      // Check for validity here
      if (!mongoDoc.valid) {
        return results[experimentID] = {
          doc: mongoDoc,
          error: new Error(`Experiment was marked invalid. Reasons: \n${JSON.stringify(mongoDoc.validityReasons, null, 2)}\n`),
          validityReasons: mongoDoc.validityReasons
        }
      }
      // Simple cases are done.

      // Now, check to see whether this document has already been submitted
      // by an mturker before.
      if (mongoDoc.mturk) {
        return results[experimentID] = {
          doc: mongoDoc,
          error: new Error(`This ExperimentID has already been claimed by an mturk worker.`)
        }
      }

      // Check to see if the same device is getting more than 3 experiments paid for
      const deviceID = mongoDoc.deviceID
      var $or = []
      if (deviceID.ICCID) {
        $or.push({'deviceID.ICCID': deviceID.ICCID})
      }
      if (deviceID.IMEI) {
        $or.push({'deviceID.IMEI': deviceID.IMEI})
      }
      if (deviceID['Build>SERIAL']) {
        $or.push({'deviceID.Build>SERIAL': deviceID['Build>SERIAL']})
      }
      $or.push({'Settings>Secure>ANDROID_ID': deviceID['Settings>Secure>ANDROID_ID']})
      const deviceResults = await collection.find({
        type: 'expt-data',
        $or,
        mturk: {$exists: true}
      })
      try {
        await new Promise((resolve, reject) => {
          deviceResults.toArray((err, docs) => {
            if (err) throw err
            if (!docs) {
              resolve()
            }
            if (docs.length > 3) {
              console.warn(`WARNING! This device has been paid for more than 3 times!`)
              return reject(new Error(`This device has already been paid more than 3 times`))
            } else if (docs.length === 3) {
              console.warn(`WARNING! This device has been paid 3 times!`)
              return reject(new Error(`This device has already been paid 3 times`))
            }
            resolve()
          })
        })
      } catch (e) {
        return results[experimentID] = {
          doc: mongoDoc,
          error: e
        }
      }

      // Everything checked out. This experiment should be accepted
      // TODO: Update mongodb marking this experiment as accepted
      const mturkData = JSON.parse(JSON.stringify(assignment))
      delete mturkData.rawAssignment
      await collection.updateOne({
        type: 'expt-data',
        experimentID: experimentID,
      }, {
        $set: {
          mturk: mturkData
        }
      })
      return results[experimentID] = {
        doc: mongoDoc
      }
    })
    await Promise.all(promises)
    return results
  }

  async processAssignment (assignment, results) {
    const hasValidResults = Object.values(results).filter(e => e.error === undefined).length > 0
    if (hasValidResults) {
      this.acceptAssignment(assignment, results)
    } else {
      this.rejectAssignment(assignment, results)
    }
  }


  getAssignmentFeedback (assignment, results) {
    const overallFeedback = []
    const totalExperiments = Object.keys(results).length
    var numValidExperiments = 0
    const experimentIDs = assignment.experimentIDs

    experimentIDs.forEach((experimentID, idx) => {
      const result = results[experimentID]
      const experimentFeedback = [experimentID]
      if (result.error) {
        if (result.validityReasons) {
          experimentFeedback.push(result.validityReasons)
        } else {
          experimentFeedback.push([result.error.message])
        }
      } else {
        experimentFeedback.push('OK')
        numValidExperiments++
      }
      // Now write to overall feedback
      overallFeedback.push(experimentFeedback.join(`\n  - `))
    })

    overallFeedback.unshift(`Reasons for rejections {{ifany}} are provided below:`.replace(' {{ifany}} ', numValidExperiments === totalExperiments ? ' ' : ' (if any) '))
    overallFeedback.unshift(`${numValidExperiments}/${totalExperiments} were accepted.`)
    return overallFeedback
  }

  async rejectAssignment (assignment, results) {
    const feedback = this.getAssignmentFeedback(assignment, results)
    const feedbackStr = feedback.join('\n')
    await this.mturk.rejectAssignment({
      AssignmentId: assignment.AssignmentId,
      RequesterFeedback: feedbackStr
    })
    console.log(`Rejected assignment '${assignment.AssignmentId}'\n${feedbackStr}`)
  }

  /**
   * Accept an assignment since it meets all the conditions.
   * This function should also calculate any applicable bonuses and issue those as well

   * @param {Assignment}  assignment    The assignment in question
   * @param {Object}      result        The mongodb document for this assignment
   */
  async acceptAssignment (assignment, results) {
    const feedback = this.getAssignmentFeedback(assignment, results)
    const feedbackStr = feedback.join('\n')
    await this.mturk.approveAssignment({
      AssignmentId: assignment.AssignmentId,
      RequesterFeedback: feedbackStr
    })
    const numValidExperiments = Object.values(results).filter(e => e.error === undefined).length
    var bonusExpts = (numValidExperiments - 1)
    bonusExpts = bonusExpts > 2 ? 2 : bonusExpts
    // Send bonus
    const bonusUuid = uuidv4()
    await this.mturk.sendBonus({
      AssignmentId: assignment.AssignmentId,
      WorkerId: assignment.WorkerId,
      Reason: `Received ${bonusExpts} valid, bonus experiments`,
      UniqueRequestToken: bonusUuid,
      BonusAmount: `${bonusExpts * 0.5}`
    })
    console.log(`Approved assignment ${assignment.AssignmentId}: ${feedback[0]}`)
  }

  async run () {
    const self = this
    const config = this.config
    await this.setupMongoClient(config.mongodb)
    const { mongoClient, db } = this
    const mturk = this.mturk
    // console.log(`Connected to mongodb`)
    // Look up pending assignments
    const hits = await mturk.listHITs()
    const hitIds = hits.HITs.map(e => e.HITId)
    // console.log(`hitIds=${JSON.stringify(hitIds)}`)

    const assignments = await self.getAllAssignmentsForHITs(hitIds)

    const promises = assignments.map(async (assignment) => {
      try {
        const assignmentResults = await self.validateAssignment(assignment, db)
        self.processAssignment(assignment, assignmentResults)
      } catch (e) {
        console.error(e)
      }
    })
    return await Promise.all(promises)
  }
}

module.exports = AssignmentChecker
