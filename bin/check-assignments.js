const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const AWS = require('aws-sdk')
const mturkPromises = require('../mturk-promises')
const AssignmentChecker = require('../assignment-checker')

AWS.config.setPromisesDependency(null)
const config = yaml.safeLoad(fs.readFileSync(path.join(__dirname, '..', 'config.yaml')))
AWS.config.update(config.aws)

const mturkConfig = config.mturk
const mturkEndpoint = mturkConfig.use_sandbox ? mturkConfig.sandbox_endpoint : mturkConfig.endpoint
const mturk = new AWS.MTurk({
  endpoint: mturkEndpoint
})
mturkPromises(mturk)

const checker = new AssignmentChecker(mturk, config)
checker.run()
