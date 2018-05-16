function __wrap (mturk, key) {
  const origFn = mturk[key]

  mturk[key] = function (params) {
    return new Promise((resolve, reject) => {
      origFn.call(mturk, params, (err, data) => {
        if (err) {
          return reject(err)
        }
        resolve(data)
      })
    })
  }
}

function wrap (mturk) {
  var functionNames = Object.getOwnPropertyNames(Object.getPrototypeOf(mturk)).filter(e => typeof mturk[e] === 'function')
  // Remove constructor
  functionNames = functionNames.filter(e => e !== 'constructor')

  functionNames.forEach((name) => {
    __wrap(mturk, name)
  })
  return mturk
}

module.exports = wrap
