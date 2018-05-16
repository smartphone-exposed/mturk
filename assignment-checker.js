const xml2js = require('xml2js')
const moment = require('moment')
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


  async validateAssignment (assignment, db) {
    const answers = assignment.Answer.Answer
    const experimentID = answers.filter(e => e.QuestionIdentifier === 'experimentID')[0]
    const collection = await this.db.collection('results')
    const result = await collection.findOne({type: 'expt-data', experimentID: experimentID})
    if (result.experimentID !== experimentID) {
      throw new Error('Experiment not found')
    }
    // Check for validity here
    return result
  }

  async rejectAssignment (assignment, err) {
    await this.mturk.rejectAssignment({
      AssignmentId: assignment.AssignmentId,
      RequesterFeedback: err.message
    })
    console.log(`Rejected assignment '${assignment.AssignmentId}' due to: '${err}'`)
  }

  async acceptAssignment (assignment) {

  }

  async run () {
    const self = this
    const config = this.config
    await this.setupMongoClient(config.mongodb)
    const { mongoClient, db } = this
    const mturk = this.mturk
    console.log(`Connected to mongodb`)
    // Look up pending assignments
    const hits = await mturk.listHITs()
    const hitIds = hits.HITs.map(e => e.HITId)
    console.log(`hitIds=${JSON.stringify(hitIds)}`)

    var promises = hitIds.map(async (hitId) => {
      return await self.getAssignmentsForHIT(hitId)
    })
    const assignmentArrays = await Promise.all(promises)
    const assignments = [].concat.apply([], ...assignmentArrays)
    console.log(JSON.stringify(assignments, null, 2))

    promises = assignments.map(async (assignment) => {
      try {
        const result = await self.validateAssignment(assignment, db)
        return await self.acceptAssignment(assignment)
      } catch (e) {
        return await self.rejectAssignment(assignment, e)
      }
    })
  }
}

module.exports = AssignmentChecker
