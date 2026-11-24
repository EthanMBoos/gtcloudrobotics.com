// A running system, looked at from the command line.

import { rosFig } from './common.js'

export default (fig) =>
  rosFig(fig, {
    nodes: ['lidar', 'base', 'avoid'],
    table: true,
    commands: ['ros2 node list', 'ros2 topic list -t', 'ros2 topic echo /cmd_vel', 'ros2 topic hz /scan'],
  })
