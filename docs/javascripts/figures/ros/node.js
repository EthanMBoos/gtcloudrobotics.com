// The avoid node, started and stopped by hand.

import { rosFig } from './common.js'

export default (fig) =>
  rosFig(fig, {
    table: true,
    commands: ['ros2 run crash_course avoid', 'ros2 node info /avoid'],
  })
