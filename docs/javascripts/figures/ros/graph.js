// Three nodes joined by topics, each of which can be stopped.

import { rosFig } from './common.js'

export default (fig) => rosFig(fig, { nodes: ['lidar', 'base', 'avoid'], table: true, toggles: true, term: false })
