// The same scans drawn in two fixed frames.

import { rosFig } from './common.js'

export default (fig) =>
  rosFig(fig, {
    nodes: ['lidar', 'base', 'avoid'],
    viz: true,
    fixed: true,
    commands: ['ros2 run tf2_ros tf2_echo odom base_link'],
  })
