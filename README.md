# Jam Skladun

## Overview

Jam Skladun is a browser-based physics puzzle game built with Phaser 3 and Matter physics. The project is client-side only and runs as a Vite application.

The player solves each level by placing their own elements into the scene and then starting the simulation. The main objective is to move all blue base shapes fully into green goal areas and keep them there for the required hold time before the level timer expires.

The intended gameplay is about building simple physical solutions such as push systems, supports, bridges, and small mechanisms by combining shapes, joints, forces, and gravity changes.

itch.io: https://olexandrch.itch.io/jam-skladun  
youtube gameplay: https://youtu.be/Y9LLYipupCA  

## Technology Stack

- JavaScript (ES modules)
- Phaser 3
- Matter.js physics through Phaser
- Vite

## Current Game Scope

- 960x720 game scene
- 320px right-side control panel
- Procedurally generated levels selected by level number 1-5
- Level-based gravity, timer, hold time, walls, goals, and obstacles
- Audio feedback with music, collision sounds, and a win sound
- Confetti and educational fact cards after successful completion

## Core Gameplay

Each level contains:

- walls
- blue base shapes that must be moved
- green goal areas
- optional obstacles that can be static or dynamic

The player may add:

- shapes for 1 point
- joints for 3 points
- forces for 3 points
- one gravity modifier for 10 points

Lower score is better. Score is not a currency and does not carry between levels. It only measures how many points the player spent to solve the current scene.

Physics starts only after the player presses the play button. While the simulation is running, the scene is locked and the player cannot edit or place elements.

## Player-Created Elements

### Shapes

Available player shapes:

- circle
- rectangle
- triangle

Shape parameters:

- position by mouse placement or X/Y inputs
- size
- rectangle width
- mass
- angle
- fixed X
- fixed Y
- fixed angle

Default mass: 10.

### Joints

A joint connects two player-created shapes.

Joint parameters:

- first shape
- second shape
- strength
- distance
- start time
- end time

Joints are applied only during play.

### Forces

A force applies to one player-created shape.

Force parameters:

- target shape
- strength
- direction X from -10 to 10
- direction Y from -10 to 10
- start time
- end time

Forces are applied only during play.

### Gravity Modifier

Only one gravity modifier may exist per level.

Gravity modifier parameters:

- X from -10 to 10
- Y from -10 to 10

The gravity modifier is added to the level gravity only during play.

## Win Conditions

- Every base shape must be fully inside a goal area.
- Base shapes are not bound to specific goal IDs.
- All valid placements must remain valid for the required hold time.
- The default required hold time is 1 second.
- Position tolerance is 0.1.
- The level fails if the timer expires first.

A base shape does not need to stop moving completely as long as it remains fully inside a goal area for the required time.

## Placement and Validation Rules

- New player shapes must not intersect walls, base shapes, obstacles, or other player shapes.
- New player shapes may overlap goal areas.
- Joints, forces, and the gravity modifier do not affect the scene before play starts.
- Draft previews must update immediately while the player edits parameters.
- Invalid draft previews must be shown in red and cannot be added.
- Existing player shapes can be edited, deleted, highlighted, and repositioned before play.
- Player element names use sequential labels such as `circle_01`, `rectangle_01`, `triangle_01`, `join_01`, `force_01`, and `gravity_01`.

## Level Configuration

Each level defines:

- gravity
- time limit
- required hold time
- walls
- base shapes
- goals
- obstacles

Default values:

- gravity: X 0, Y 9
- time limit: 60 seconds
- required hold time: 1 second
- mass: 10
- tolerance: 0.1

The current UI generates levels for difficulty slots 1-5. Higher level numbers can include more base/goal pairs and more obstacles.

## World Limits

Player shapes may be placed outside the visible scene. The current world limit is `100000` units from the scene. Bodies that travel beyond this limit are removed from further simulation.

## UI

The current interface includes:

- a top bar with level selection, Generate button, music toggle, visible gravity, score, and timer
- a right-side panel with Play, Stop, and Reset buttons
- an Add tab for creating new elements
- an Elements tab for reviewing and editing added elements

Selecting a shape type must immediately show a draft preview in the scene. Editing form values must update the preview in real time.

## Persistence

Local storage is used for:

- score stats: best, worst, and average score
- fact card progress, so win facts do not repeat too often

## Art Direction

Core gameplay graphics are generated from simple geometric shapes rather than gameplay sprites.

Base color palette:

- background: `#1B2130`
- walls: `#A8B3C7`
- obstacles: `#A8B3C7`
- base shapes: `#7070FF`
- player shapes: `#A894E0`
- goals: `#A2ECD3`
- joints: `#D4AEAE`
- forces: `#FFB84D`

Mechanism images are used for post-win fact cards.
