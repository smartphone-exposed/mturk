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
    return Array.from(new Set(this.Answer.experimentID.split(',')))
  }
}

module.exports = Assignment
