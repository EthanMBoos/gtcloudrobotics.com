---
icon: lucide/terminal
---

# ROS 2

A robot runs many programs at once (sensor drivers, a path planner, a motor
controller), and ROS 2 is the middleware that connects them. Middleware is a
layer of software that carries messages from one program to another within the
robot. By default the messages travel over DDS (Data Distribution Service), an
industry standard for publish-subscribe messaging in which programs find each
other without a central server. This page covers the main ideas in order, using a small wheeled robot
with a lidar. Each figure runs a simulated robot and an imitation of the `ros2`
command line in the browser, so nothing needs to be installed.

## Nodes and topics

A program that takes part in a ROS 2 system is called a node. Nodes do not call
each other. Instead, a node publishes messages on a named channel, which we
refer to as a topic, and every node that subscribes to that topic receives
them.

The robot in the figure runs three nodes. `lidar` is the driver for the laser
scanner, and it publishes each sweep on `/scan`. `base` is the motor driver, and it
subscribes to `/cmd_vel`, which carries the velocity the robot should have.
`avoid` subscribes
to `/scan` and publishes on `/cmd_vel`. It drives forward until something is
close ahead and then turns left.

<figure class="fig" data-figure="ros-graph">
  <figcaption>Red is the latest lidar sweep, teal is where the latest velocity command would take the robot in two seconds, and the dark line is the path driven. The diagram above the scene has one arrow per topic, from the node that publishes it to each node that subscribes, and an arrow moves while messages flow.</figcaption>
</figure>

The diagram is the whole structure of the system: three nodes, joined by topics
into a loop from the sensor to a decision to the motors. Stopping a node shows
what the others depend on. With `avoid` stopped, `/cmd_vel` falls silent and
the robot stops, while `lidar` keeps publishing, because a publisher does not
know whether anything is subscribed. With `lidar` stopped, `avoid` is still
running but receives nothing, so it publishes nothing, and the robot stops for
the same reason.

This independence is the purpose of ROS 2. `avoid` depends only on the names
and types of two topics, so it would run unchanged on a real robot whose
drivers publish `/scan` and accept `/cmd_vel`, and equally against a simulator
that does the same. For the same reason, a mapping or navigation package
written by someone else can be used on a new robot without modifying it.

## Looking at a running system

Because all communication passes through topics, a running system can be
inspected from outside. The `ros2` command line tool does this by joining the
system as one more node.

<figure class="fig" data-figure="ros-inspect">
  <figcaption>Click the terminal and type the commands listed above the figure. Tab completes a name, the up arrow recalls the last command, and Ctrl-C stops a command that keeps running. The second terminal is independent of the first.</figcaption>
</figure>

`ros2 node list` and `ros2 topic list -t` print the nodes and the topics. (The
topics `/parameter_events` and `/rosout` are created by every node and can be
ignored here.) Each topic has a type, which fixes the fields of its messages,
and `ros2 topic echo` prints the messages as they arrive. A type is defined in
a short text file that lists its fields. The messages on `/cmd_vel` are of type
`Twist`, which is defined as two vectors:

```
# geometry_msgs/msg/Twist.msg
Vector3 linear
Vector3 angular

# geometry_msgs/msg/Vector3.msg
float64 x
float64 y
float64 z
```

A wheeled robot uses two of these six numbers: `linear.x` is the forward speed
in m/s, and `angular.z` is the turn rate in rad/s, where a positive value turns
left. The same files generate the `Twist` class for Python and for C++, so
nodes written in different languages can exchange the message.

`ros2 topic hz` measures the rate of a topic. While `echo` runs, the diagram
shows the command as an additional subscriber to the topic, which is all that
it is.
Together these commands answer the first questions to ask when a system does
not work: whether a node is running, whether it publishes, at what rate, and
what the messages contain.

## Driving the robot

Publishing works from the command line as well. `base` moves the robot
according to the most recent message on `/cmd_vel`, regardless of which node
sent it. In the figure below `avoid` is not running, so nothing publishes on
`/cmd_vel` until the terminal does.

<figure class="fig" data-figure="ros-drive">
  <figcaption>While the teleop node runs, hold a key with the terminal focused: <code>i</code> drives forward, <code>,</code> drives backward, <code>j</code> and <code>l</code> turn, and <code>k</code> stops.</figcaption>
</figure>

`ros2 topic pub` publishes the message given as its last argument, here ten
times per second, and the robot drives in a circle until Ctrl-C. The repetition
is necessary: `base` discards a command that is older than 0.6 s, so that the
robot does not keep driving when the node that controls it has crashed. Most
real motor drivers do the same. Without `--rate 10` the command publishes once
per second, which is slower than the timeout, and the robot moves in bursts.

`ros2 run` starts a node from an installed package. `teleop_twist_keyboard` is
a standard node that converts key presses into the same `Twist` messages. The
robot has now been driven by three different publishers (`avoid`, the `ros2`
tool, and the teleop node), and `base` was the same in each case.

## Writing a node

A node is an ordinary program that uses the ROS 2 client library, which is
`rclpy` for Python and `rclcpp` for C++. The following is the complete source
of `avoid`.

```python
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from sensor_msgs.msg import LaserScan


class Avoid(Node):
    def __init__(self):
        super().__init__('avoid')
        self.declare_parameter('speed', 0.4)
        self.declare_parameter('stop_distance', 0.8)
        self.pub = self.create_publisher(Twist, '/cmd_vel', 10)
        self.create_subscription(LaserScan, '/scan', self.on_scan, 10)
        self.get_logger().info('avoiding obstacles')

    def on_scan(self, scan):
        mid = len(scan.ranges) // 2
        ahead = min(scan.ranges[mid - 15 : mid + 15])
        cmd = Twist()
        if ahead > self.get_parameter('stop_distance').value:
            cmd.linear.x = self.get_parameter('speed').value
        else:
            cmd.angular.z = 1.0
        self.pub.publish(cmd)


def main():
    rclpy.init()
    rclpy.spin(Avoid())
```

The constructor names the node and creates a publisher and a subscription. The
subscription registers `on_scan` as a callback, i.e., a function that the
library calls once for each message that arrives. `rclpy.spin` then hands
control to the library, which waits for messages and calls the callback, so the
node contains no loop of its own. The argument `10` is the number of messages
to keep in a queue when the node falls behind.

The callback uses the layout of the scan. This lidar reports 180 ranges, which
start directly behind the robot and proceed counterclockwise, so the middle of
the array points ahead, and the thirty ranges around it cover the 60° in front
of the robot.

<figure class="fig" data-figure="ros-node">
  <figcaption>The robot's two drivers are running. The first command starts <code>avoid</code> in one terminal, and the second inspects it from the other.</figcaption>
</figure>

On a real system this file belongs to a package, which is a directory that also
holds a manifest of its dependencies and is built with `colcon build`. The name
that `ros2 run` accepts comes from one line in the `setup.py` of the package,
which maps an executable name to the `main` function above:

```python
entry_points={
    'console_scripts': ['avoid = crash_course.avoid:main'],
},
```

Here the package `crash_course` is already built, and `ros2 run crash_course avoid`
starts the node. The output of `ros2 node info /avoid` lists the publisher and
the subscription that the constructor created, and Ctrl-C in the first terminal
stops the node and therefore the robot.

## Parameters and services

Topics suit data that flows continuously, and ROS 2 provides two further
mechanisms for the remaining cases. A parameter is a named value inside a node
that can be read and changed while the node runs (e.g., the speed of `avoid`).
A service is a request to a node that returns a response, and it is used for
operations that happen once (e.g., a reset).

<figure class="fig" data-figure="ros-params">
  <figcaption>All three nodes are running. The parameters belong to the nodes, so a change lasts until the node is restarted.</figcaption>
</figure>

Setting `speed` on `avoid` takes effect at the next scan, because the callback
reads the parameter each time it runs. Setting `range_max` on `lidar` to 2 m
removes the returns from the far walls, and `avoid` continues to work, because
it needs to see only 0.8 m ahead. Setting `stop_distance` to 0.2 m, which is
less than the radius of the robot, makes it drive into the walls.

`ros2 service call /reset` asks `base` to put the robot back at its starting
pose, which is possible only because the robot is simulated. Offering a service
resembles subscribing to a topic, except that the callback returns a response
to the caller:

```python
from std_srvs.srv import Empty

class Base(Node):
    def __init__(self):
        super().__init__('base')
        self.create_service(Empty, '/reset', self.on_reset)

    def on_reset(self, request, response):
        self.pose = (0.0, 0.0, 0.0)
        return response
```

The output of `ros2 service list` shows that every node also offers a group of services for
its own parameters, and `ros2 param` is a shorthand for calling them. A third
mechanism, the action, handles requests that take a long time, report progress,
and can be canceled (e.g., driving to a goal). We do not use actions on this
page.

## Frames

A scan is a list of ranges measured from the lidar, so drawing it on a map
requires knowing where the lidar was. ROS 2 handles this with named coordinate
frames. A message that carries spatial data names its frame in its header
(`laser` for a scan), and nodes publish the transforms between frames on the
topic `/tf`. Here `base` publishes the transform from `odom`, a frame fixed at
the point where the robot started, to `base_link`, the body of the robot. The
transform from `base_link` to `laser` never changes, so it is published once on
`/tf_static`.

<figure class="fig" data-figure="ros-frames">
  <figcaption>Left: the room. Right: only what the topics carry, with each scan transformed into the fixed frame when it arrives and kept for four seconds. Blue is the pose of the robot according to <code>/tf</code>. The axes mark the frames, with x in red and y in green.</figcaption>
</figure>

The right pane works in the way that RViz, the standard ROS 2 visualizer, does.
With the fixed frame set to `odom`, each scan is placed using the pose of the
robot at the time of the scan, so successive scans fall on the same walls and
the outline of the room appears. With the fixed frame set to `base_link`, each
scan is drawn relative to the robot, and the scans of the last four seconds
smear whenever the robot turns, because nothing accounts for its motion in
between. The data is the same in both cases, and the only difference is whether
the transform from `odom` to `base_link` is applied.

A node does not read `/tf` itself. It creates a buffer, which subscribes to
`/tf` and `/tf_static` and chains the transforms, and then asks the buffer for
the transform between any two frames:

```python
from rclpy.time import Time
from tf2_ros import Buffer, TransformListener

# in the constructor of a node
self.buffer = Buffer()
self.listener = TransformListener(self.buffer, self)

# in a callback: where is the lidar in the odom frame?
t = self.buffer.lookup_transform('odom', 'laser', Time())
x = t.transform.translation.x
```

The answer here combines the moving transform from `odom` to `base_link` with
the fixed one from `base_link` to `laser`, and `Time()` requests the most
recent transform available.

On a real robot the pose from the wheels drifts, which is the subject of the
[sensor fusion intro](sensor-fusion/intro.md). Here it is exact, because the
simulation reports the true pose.

## Recorded data

Nodes interact only through topics, so a node cannot distinguish a live message
from a recorded one. A bag is a file of recorded messages with their times.
`ros2 bag record` subscribes to topics and writes what arrives, and
`ros2 bag play` publishes the contents again with the original timing.

<figure class="fig" data-figure="ros-bag">
  <figcaption>The panes are those of the previous figure. Switching off the robot power stops all three nodes.</figcaption>
</figure>

To see this, we record for about ten seconds, stop the recording with Ctrl-C,
and switch off the robot. The right pane empties, since nothing publishes. When
we then play the bag, the pane shows the recorded drive while the robot stands
still, and `ros2 topic list` in the second terminal shows the recorded topics,
now published by the player. With `--loop` the bag repeats until Ctrl-C. A node that subscribes to `/scan` (e.g., a mapping node) would run
on the recording exactly as it does on the robot. Most work on perception and
estimation is done this way: the data is recorded on the robot once, and the
code is then developed against the bag.

A bag must contain every topic that its consumers need. A bag that records
`/scan` alone shows nothing when it is played with the robot switched off,
because the transforms needed to place the scans were not recorded.

## A real installation

The commands on this page are those of a real ROS 2 installation, with the
exception of the `crash_course` package. The
[installation guide](https://docs.ros.org/en/jazzy/Installation.html) covers
Ubuntu, where ROS 2 is installed from packages, and other systems, where a
Docker image (e.g., `ros:jazzy`) is the simplest route. We omitted three things
that a first project will need. A launch file starts several nodes with one
command and can set their parameters, so the three nodes on this page would be
started by `ros2 launch crash_course robot.launch.py` with the following file:

```python
from launch import LaunchDescription
from launch_ros.actions import Node

def generate_launch_description():
    return LaunchDescription([
        Node(package='crash_course', executable='lidar'),
        Node(package='crash_course', executable='base'),
        Node(package='crash_course', executable='avoid',
             parameters=[{'speed': 0.6}]),
    ])
```

A workspace holds our own packages and is built with `colcon`. Quality
of service (QoS) settings control how a topic delivers messages, and a
publisher and a subscriber with incompatible settings do not connect, which is
a common reason for a subscriber that receives nothing. The official
[tutorials](https://docs.ros.org/en/jazzy/Tutorials.html) cover each of these.
