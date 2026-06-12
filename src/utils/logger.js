import pino from 'pino';

const transport = process.env.NODE_ENV === 'development'
  ? pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        singleLine: false,
        mkdir: true,
        destination: 1
      }
    })
  : undefined;

const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  transport
);

export default logger;
