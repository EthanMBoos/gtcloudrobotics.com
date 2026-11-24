// Parameters and a service on the running nodes.

import { rosFig } from './common.js'

export default (fig) =>
  rosFig(fig, {
    nodes: ['lidar', 'base', 'avoid'],
    commands: ['ros2 param list', 'ros2 param set /avoid speed 0.8', 'ros2 service call /reset std_srvs/srv/Empty'],
  })
