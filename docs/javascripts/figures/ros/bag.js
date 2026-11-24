// Record the topics, switch the robot off, and play them back.

import { rosFig } from './common.js'

export default (fig) =>
  rosFig(fig, {
    nodes: ['lidar', 'base', 'avoid'],
    viz: true,
    power: true,
    commands: ['ros2 bag record -o drive --topics /scan /tf /tf_static', 'ros2 bag play drive --loop'],
  })
