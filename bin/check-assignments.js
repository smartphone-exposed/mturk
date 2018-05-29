const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const AWS = require('aws-sdk')
const root = path.join(__dirname, '..')
const mturkPromises = require(path.join(root, 'mturk-promises'))
const AssignmentChecker = require(path.join(root, 'assignment-checker'))

AWS.config.setPromisesDependency(null)
const config = yaml.safeLoad(fs.readFileSync(path.join(root, 'config.yaml')))
AWS.config.update(config.aws)

const mturkConfig = config.mturk
const mturkEndpoint = mturkConfig.use_sandbox ? mturkConfig.sandbox_endpoint : mturkConfig.endpoint
const mturk = new AWS.MTurk({
  endpoint: mturkEndpoint
})
mturkPromises(mturk)

const checker = new AssignmentChecker(mturk, config)

function checkAssignments () {
  // console.log(`Running checker ...`)
  checker.run()
}

checkAssignments()
setInterval(checkAssignments, 1 * 60 * 60 * 1000)
