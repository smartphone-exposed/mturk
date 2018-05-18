// This depends __heavily__ on the format of the forms as defined on the mturk
// page. If the form changes, then this class will need to be changed
class Assignment {
  constructor (json) {
    Object.assign(this, json)
    this.rawAssignment = json
    const self = this
    const answer = json.Answer.Answer
    this.Answer = {}
    answer.forEach((entry) => {
      self.Answer[entry.QuestionIdentifier] = entry.FreeText
    })
  }

  get experimentIDs() {
    const experimentIDs = []
    if (this.Answer.experimentID.length > 0) {
      experimentIDs.push(...Array.from(new Set(this.Answer.experimentID.split(','))))
    }
    if (this.Answer.fakeExperimentID.length > 0) {
      // We have an experiment left over here. Add that too
      const unparsedExperiments = this.Answer.fakeExperimentID.split(',').filter(e => e.length !== 0)
      experimentIDs.push(...unparsedExperiments)
    }
    return experimentIDs
  }
}

module.exports = Assignment
