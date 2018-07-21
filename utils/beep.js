const { spawn } = require( 'child_process' )

const beep = function(times) {
  if (!times) {
    times = 1
  }
  for(var i = 0; i < times; i++) {
    console.log('\u0007')
  }
}

// beep(3)

module.exports = beep