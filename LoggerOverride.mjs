const bold = str => `\x1b[1m${str}\x1b[22m`
const green = str => `\x1b[32m${str}\x1b[0m`
const levelColors = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  debug: '\x1b[35m',
  info: '\x1b[34m',
  trace: '\x1b[36m',
  fatal: '\x1b[91m'
}
const reset = '\x1b[0m'

export default async robot => {
    const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal']
    levels.forEach(level => {
      robot.logger[level] = async (...args) => {
        const color = levelColors[level] || ''
        const msg = `${color}[${level}]${reset} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`
        console.log(msg)
      }
    })
}