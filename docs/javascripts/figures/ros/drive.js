// Nothing publishes /cmd_vel until the terminal does.

import { rosFig } from './common.js'

export default (fig) =>
  rosFig(fig, {
    table: true,
    commands: [
      'ros2 topic pub --rate 10 /cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.3}, angular: {z: 0.6}}"',
      'ros2 run teleop_twist_keyboard teleop_twist_keyboard',
    ],
  })
