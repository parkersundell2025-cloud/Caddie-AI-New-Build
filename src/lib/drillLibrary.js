// Caddie AI Proprietary Drill Library — used for progressive overload logic

import { parseDateLocal } from '@/lib/dateUtils';

export const DRILL_LIBRARY = {
  Driving: [
    { name: 'The Tempo Towel Drill', description: 'Train smooth rhythm and tempo in your swing', difficulty: 'Beginner', club: '7 Iron → Driver', reps: '15 swings with 7 iron, then 10 with driver', instructions: 'Tuck a small towel under your lead armpit. Make full swings without letting the towel drop. If it drops you are disconnecting your arms from your body at the top.', tip: 'If the towel drops on the backswing you are lifting your arms. If it drops on the downswing you are casting.' },
    { name: 'The Gate Drill — Driver', description: 'Hit straighter drives with better club path', difficulty: 'Beginner', club: 'Driver', reps: '20 balls', instructions: 'Place two alignment sticks in the ground just outside the ball line — one 12 inches in front and one 12 inches behind, angled to create a gate along your target line. Hit driver through the gate without touching either stick.', tip: 'If you keep hitting the outside stick you are swinging over the top. Focus on dropping the club inside on the downswing.' },
    { name: 'The Slow Motion Drill', description: 'Build muscle memory for a repeatable swing', difficulty: 'Beginner', club: 'Driver', reps: '10 slow motion swings then 5 at full speed', instructions: 'Make your full driver swing at 25% speed. Stop at address, top of backswing, impact, and follow through. Hold each position for 3 seconds and check it feels correct.', tip: 'The positions that feel wrong at slow speed are exactly what is happening at full speed. Fix the feeling, not the result.' },
    { name: 'The Tee Height Ladder', description: 'Find your optimal driver tee height', difficulty: 'Beginner', club: 'Driver', reps: '15 balls total (5 low, 5 medium, 5 high tee)', instructions: 'Hit 5 balls with tee very low, 5 with medium tee (equator at crown), and 5 with high tee (ball fully above crown). Note which produces the straightest most consistent flight.', tip: 'Most amateurs tee the ball too low causing topped shots or low hooks. Experiment honestly and commit to what works.' },
    { name: 'The Foot Together Drill', description: 'Improve balance and center contact', difficulty: 'Beginner', club: 'Driver', reps: '15 balls', instructions: 'Stand with feet together touching. Hit driver at 70% speed. You will fall over if your balance is off. The goal is to finish in a full balanced pose every time.', tip: 'If you cannot stay balanced your swing has too much lateral movement. Focus on rotating around your spine not shifting side to side.' },
    { name: 'The Alignment Stick Path Drill', description: 'Fix your swing path with alignment sticks', difficulty: 'Intermediate', club: 'Driver', reps: '20 balls', instructions: 'Place an alignment stick at 45 degrees just outside your back foot pointing away from you. On the downswing feel the club drop inside the stick and attack the ball from inside the target line.', tip: 'An inside-out path turns a slice into a draw. The ball will initially feel like it is going right — that is correct.' },
    { name: 'The Impact Bag Drill', description: 'Train a powerful impact position', difficulty: 'Intermediate', club: '6 Iron', reps: '20 strikes', instructions: 'Place an impact bag where the ball would be. Make half swings and drive the bag with your hands leading the clubhead. Hold the impact position and check hands are in front of the bag and hips are slightly open.', tip: 'If the bag moves straight back you are flipping. The bag should compress and move slightly forward and left at impact.' },
    { name: 'The 3 Ball Progression', description: 'Build consistency with progressive difficulty', difficulty: 'Intermediate', club: 'Driver', reps: '5 sets of 3 balls (15 total)', instructions: 'Hit first ball at 50% effort focused only on contact. Hit second at 75% focused on direction. Hit third at full effort trusting the previous two swings. Repeat in sets of three.', tip: 'Most amateurs hit every ball at full effort from the first swing. Building up teaches your body to sequence correctly before adding power.' },
    { name: 'The L to L Drill', description: 'Master the perfect backswing and follow through', difficulty: 'Intermediate', club: '7 Iron → Driver', reps: '20 swings with 7 iron then apply to driver', instructions: 'Make half swings stopping when your lead arm is parallel to the ground on the backswing (L shape) and your trail arm is parallel on the follow through (L shape). Feel the club release naturally between the two L positions.', tip: 'If you cannot make the second L your release is early (casting) or you are not finishing your swing.' },
    { name: 'The Eyes Closed Drill', description: 'Develop feel and proprioception in your swing', difficulty: 'Intermediate', club: 'Driver', reps: '10 swings', instructions: 'Set up normally then close your eyes before you start your backswing. Make a full swing by feel. Open your eyes only after you have held your finish.', tip: 'Most golfers are surprised how well they strike it with eyes closed because they stop steering the ball and let the swing happen naturally.' },
    { name: 'The Step Through Drill', description: 'Generate more power and speed', difficulty: 'Intermediate', club: 'Driver', reps: '15 balls', instructions: 'Start with feet together. As you begin the downswing step your lead foot toward the target and swing through. This forces your hips to rotate and your weight to shift correctly.', tip: 'If you are a slider or a flipper this drill immediately fixes the sequence. The step forces the body to go first and the arms to follow.' },
    { name: 'The 9 Shot Shape Drill', description: 'Learn to control ball flight on demand', difficulty: 'Advanced', club: 'Driver', reps: '9 balls (3 draws, 3 straight, 3 fades)', instructions: 'Hit 3 draws (aim right, swing inside-out), 3 straight shots, and 3 fades (aim left, swing outside-in). Focus only on starting the ball on the correct line and curving it the intended direction.', tip: 'If you cannot hit all 9 shapes on demand you do not yet own your swing. Start with the shape that is easiest for you.' },
    { name: 'The Speed Training Drill', description: 'Maximize your driver distance', difficulty: 'Advanced', club: '3 Wood → Driver', reps: '9 balls in sets', instructions: 'Hit 3 balls with your 3 wood at max effort. Then 3 driver at 50% effort. Then 3 driver at max effort. The contrast trains your nervous system to produce more speed on demand.', tip: 'Speed gains happen over weeks not one session. Do this drill once per week consistently for 8 weeks and measure the difference.' },
  ],
  'Iron Play': [
    { name: 'The Divot Board Drill', description: 'Train consistent ball first contact with irons', difficulty: 'Beginner', club: '7 Iron', reps: '20 balls with a 7 iron', instructions: 'Place a piece of cardboard behind the ball about 2 inches. Make iron swings without hitting the board. If you hit the board you are bottoming out behind the ball.', tip: 'Your divot should start at the ball and continue forward. A divot behind the ball means your low point is too far back.' },
    { name: 'The Pump Drill', description: 'Fix your downswing sequence and lag', difficulty: 'Beginner', club: '7 Iron', reps: '15 swings', instructions: 'Take your backswing and stop at the top. Then pump the club down halfway three times feeling your lower body initiate each pump. On the fourth pump make a full swing.', tip: 'If your arms start the downswing you will come over the top every time. The pump teaches you to feel the lower body leading.' },
    { name: 'The Yardage Marker Drill', description: 'Improve distance control with every iron', difficulty: 'Beginner', club: '7 Iron', reps: '10 balls per iron', instructions: 'Pick one specific yardage marker at the range. Hit 10 balls with your 7 iron trying to land on that marker every time. Note how many you land within 10 yards. Repeat with each iron.', tip: 'Most amateurs do not know their actual carry distances. This drill gives you real data to use on the course.' },
    { name: 'The Coin Drill', description: 'Train precise ball striking and center contact', difficulty: 'Beginner', club: '7 Iron', reps: '20 swings', instructions: 'Place a coin on the ground and try to sweep it forward with your iron swing rather than digging into the ground. The goal is to brush the coin forward not chunk the ground behind it.', tip: 'This is the single best drill for golfers who hit it fat. The mental image of sweeping the coin forward changes the angle of attack immediately.' },
    { name: 'The Headcover Drill', description: 'Stop hitting fat and thin iron shots', difficulty: 'Beginner', club: '6 Iron', reps: '20 balls', instructions: 'Place a headcover about 6 inches outside and behind the ball. Make iron swings without hitting the headcover on the downswing. If you hit it you are coming over the top.', tip: 'Most amateur iron shots go left or pull because of an outside-in path. This drill makes the correct path feel obvious.' },
    { name: 'The Ball Position Ladder', description: 'Find perfect ball position for every iron', difficulty: 'Beginner', club: '7 Iron', reps: '15 balls (5 back, 5 middle, 5 forward)', instructions: 'Hit 5 balls with ball back in stance, 5 middle, and 5 forward. Note the flight, contact quality, and direction of each position for your 7 iron.', tip: 'Short irons should be middle to slightly back. Long irons slightly forward of middle. Most amateurs play everything too far forward.' },
    { name: 'The Towel Under Lead Arm Drill', description: 'Keep your arms connected through impact', difficulty: 'Intermediate', club: '7 Iron', reps: '20 swings with a 7 iron', instructions: 'Tuck a small towel under your lead armpit and make iron swings without dropping it through impact. The towel dropping means your arm is separating from your chest.', tip: 'Connected iron swings are more consistent and produce more compression. Disconnected arms cause flipping and thin shots.' },
    { name: 'The Miss Drill', description: 'Understand and eliminate your common miss', difficulty: 'Intermediate', club: '7 Iron', reps: '10 balls each stage', instructions: 'Set up two alignment sticks 20 yards apart as a gate at your target. Hit 10 balls trying to keep every shot within the gate. Then narrow it to one stick and try to hit within 10 yards of it.', tip: 'On the course you rarely get to aim at the pin. Train to hit your miss zone not your perfect shot.' },
    { name: 'The Half Swing Compression Drill', description: 'Train a compressed penetrating ball flight', difficulty: 'Intermediate', club: '7 Iron', reps: '20 half swings then 10 full swings', instructions: 'Make half swings with a 7 iron — backswing stopping when lead arm is parallel, follow through stopping when trail arm is parallel. Focus entirely on hitting down and compressing the ball against the ground.', tip: 'If your half swing contact is solid and your full swing is not the problem is in your transition. You are losing your angles at the top.' },
    { name: 'The Knockdown Drill', description: 'Control trajectory in wind and pressure situations', difficulty: 'Intermediate', club: '6 Iron', reps: '15 balls', instructions: 'Take one extra club than normal (6 iron instead of 7). Choke down one inch. Make a 75% swing with an abbreviated follow through finishing with hands low. The ball should fly lower and straighter with more spin.', tip: 'Tour players use this shot constantly under pressure. It is more reliable than a full swing because there are less moving parts.' },
    { name: 'The Random Club Drill', description: 'Build adaptability and feel across all irons', difficulty: 'Advanced', club: 'Any Iron', reps: '15 balls with random clubs', instructions: 'Without thinking pick up any iron randomly. Look at one target. Hit the shot with that club adjusting your swing to fit the distance. Then pick another random club and a different target.', tip: 'Real golf never gives you the perfect club for the perfect distance. This drill builds on-course creativity.' },
    { name: 'The One Handed Drill', description: 'Develop feel and control with each hand', difficulty: 'Advanced', club: '9 Iron', reps: '30 balls (10 lead only, 10 trail only, 10 both)', instructions: 'Hit 10 balls with lead hand only, then 10 with trail hand only, then 10 with both hands applying what you felt from each. Use a short iron at 50% speed.', tip: 'Most right handed golfers are too trail hand dominant causing flipping. Lead hand only swings teach the correct pulling sensation through impact.' },
    { name: 'The Par 3 Simulation Drill', description: 'Practice realistic on-course iron shots', difficulty: 'Advanced', club: '8 Iron', reps: '9 holes of simulated par 3s', instructions: 'Pick a specific target on the range. Pretend it is a par 3 and you have one shot. Go through your full pre-shot routine. Score yourself — inside 20 feet is a birdie putt, 20 to 40 feet is par, outside 40 is bogey.', tip: 'Range practice without consequence trains nothing for the course. This drill creates real pressure and teaches you to commit to a target.' },
  ],
  'Short Game': [
    { name: 'The Landing Spot Drill', description: 'Train precision chipping to a specific target', difficulty: 'Beginner', club: 'Pitching Wedge', reps: '20 chips from the same spot', instructions: 'Pick a spot on the green 2 feet onto the putting surface — not the hole, just the landing spot. Chip every ball to land on that spot and let it roll out. Adjust your landing spot based on where the ball finishes.', tip: 'Amateurs aim at the hole. Tour players aim at the landing spot. This single change will immediately improve your chipping consistency.' },
    { name: 'The Bump and Run Drill', description: 'Master the low running chip around the green', difficulty: 'Beginner', club: '7 Iron', reps: '20 chips to a hole 15 to 20 feet away', instructions: 'Use a 7 or 8 iron for chips within 20 yards of the green. Play the ball back in your stance. Make a putting stroke motion keeping hands ahead of the ball. Let the ball run to the hole like a putt.', tip: 'When in doubt use less loft. Most amateurs reach for a lob wedge when a 7 iron bump and run is safer and more consistent.' },
    { name: 'The No Wristed Chip Drill', description: 'Eliminate wrist breakdown in chipping', difficulty: 'Beginner', club: 'Gap Wedge', reps: '20 chips', instructions: 'Make chip swings keeping your wrists completely firm — no hinge, no release. Feel like you are pushing the grip end of the club toward the target through impact. Your hands should stay ahead of the ball at all times.', tip: 'Wristy chipping is the most common amateur mistake around the green. Firm wrists and hands forward cures it immediately.' },
    { name: 'The Fringe Ladder Drill', description: 'Control distance from the fringe perfectly', difficulty: 'Beginner', club: 'Pitching Wedge', reps: '20 chips from 4 distances', instructions: 'Place 5 balls at 5 yards, 5 at 10 yards, 5 at 15 yards, and 5 at 20 yards from the green. Chip each set to the same hole. Score yourself based on how close you finish each chip.', tip: 'Distance control in chipping comes from length of swing not speed of swing. Longer swing for longer chip, same tempo throughout.' },
    { name: 'The Bunker Line Drill', description: 'Build consistent bunker technique and contact', difficulty: 'Beginner', club: 'Sand Wedge', reps: '20 practice swings then 20 with a ball', instructions: 'Draw a line in the sand 2 inches behind where the ball would be. Practice hitting the line with your sand wedge without a ball. The goal is to enter the sand on the line every time. Add a ball once consistent.', tip: 'Bunker shots are not about hitting the ball — they are about hitting the sand in the right spot. Fix your entry point and the ball takes care of itself.' },
    { name: 'The Towel Drill — Short Game', description: 'Train proper chipping technique and contact', difficulty: 'Intermediate', club: 'Gap Wedge', reps: '20 chips', instructions: 'Place a small towel 3 inches behind the ball. Make chip swings without hitting the towel. If you hit the towel your swing is bottoming out too early.', tip: 'Combine with the no wristed chip drill. Firm wrists and avoiding the towel produces pure crisp chip shots every time.' },
    { name: 'The Clock Drill — Wedges', description: 'Build consistent wedge distance control', difficulty: 'Intermediate', club: 'Gap Wedge', reps: '15 balls across 3 swing lengths', instructions: 'Think of your swing as a clock. 9 o\'clock backswing (lead arm parallel) produces one distance. 10 o\'clock produces more. 11 o\'clock produces maximum. Hit 5 balls with each clock position with your gap wedge and measure the carry of each.', tip: 'Tour players know their exact yardages for each clock position. Build your own yardage chart and use it on the course.' },
    { name: 'The Flop Shot Progression', description: 'Learn to hit high soft flop shots', difficulty: 'Intermediate', club: 'Lob Wedge', reps: '5 at each of 3 stages', instructions: 'Start with a 50% open face chip from tight lie — just get it up. Progress to a fuller swing with fully open face. Finally attempt the full flop from a tight lie. Only advance when the previous stage is consistent.', tip: 'The flop shot is the highest risk shot in golf. Only use it when there is no other option. A half-hearted flop is a shank.' },
    { name: 'The Up and Down Challenge', description: 'Simulate real scrambling pressure situations', difficulty: 'Intermediate', club: 'Sand Wedge', reps: '10 up and down attempts', instructions: 'Drop a ball in 10 different spots around a practice green — varying distances, lies, and angles. From each spot chip onto the green and take 2 putts maximum. Count how many times you get up and down in 2.', tip: 'Tour average for scrambling is around 60%. Amateur average is around 20%. Practicing this drill weekly for a month will transform your scoring.' },
    { name: 'The One Club Challenge', description: 'Develop creativity and feel around the green', difficulty: 'Intermediate', club: 'Sand Wedge', reps: '30 minutes of open practice', instructions: 'Take only one wedge to the practice green. Hit every shot — chips, pitches, bump and runs, even bunker shots — with that one club. Adjust your setup and swing to manufacture different shots.', tip: 'Limitations build creativity. Seve Ballesteros became the greatest short game player in history partly by practicing with one club as a child.' },
    { name: 'The Wet Towel Lie Drill', description: 'Practice difficult lies and tight lies', difficulty: 'Advanced', club: 'Sand Wedge', reps: '15 chips from 3 different lies', instructions: 'Create difficult lies on purpose — push the ball into thick rough, place it in a divot, find a bare tight lie. Hit 5 chips from each lie type and learn how each lie affects the shot. Adjust your technique for each.', tip: 'You never get perfect lies on the course. Practicing from bad lies removes the fear of them.' },
    { name: 'The Spin Control Drill', description: 'Learn to control backspin with your wedges', difficulty: 'Advanced', club: 'Lob Wedge', reps: '20 shots', instructions: 'Hit 10 wedge shots from 30 yards trying to make the ball check and stop. Then hit 10 trying to make the ball release and roll forward after landing. The difference is ball position, face angle, and follow through length.', tip: 'Stopping the ball requires a clean lie, descending blow, and high spin loft. Rolling the ball out requires a wider stance and shallower angle.' },
    { name: 'The Pressure Chip Off', description: 'Compete against yourself under real pressure', difficulty: 'Advanced', club: 'Gap Wedge', reps: 'Until you pass 3 consecutive stations', instructions: 'Pick a hole on the practice green. Give yourself 10 chips from 10 yards. You must get up and down 6 out of 10 to pass. If you fail do 10 pushups and start again. If you pass move to 15 yards and repeat.', tip: 'Pressure practice is the only way to prepare for pressure on the course. The pushup consequence is small but real pressure changes everything.' },
  ],
  Putting: [
    { name: 'The Gate Drill — Putting', description: 'Train your putter face square through impact', difficulty: 'Beginner', club: 'Putter', reps: '30 putts from 6 feet', instructions: 'Place two tees just wider than your putter head 6 inches in front of the ball on your target line. Make putting strokes sending the ball through the gate. If you hit a tee your face was open or closed at impact.', tip: 'Most missed putts are missed because of face angle not path. Fix the face and your putts start going in.' },
    { name: 'The Coin Putting Drill', description: 'Improve center contact on the putter face', difficulty: 'Beginner', club: 'Putter', reps: '20 strokes', instructions: 'Place a coin on the putting green and try to hit it dead center with your putter. The coin will tell you instantly if you are hitting toe, heel, or center. No ball needed.', tip: 'Off center putts lose both distance and direction. Center face contact is non-negotiable for good putting.' },
    { name: 'The 3 Foot Circle Drill', description: 'Build confidence making every short putt', difficulty: 'Beginner', club: 'Putter', reps: 'Complete 3 full circles of 8 balls', instructions: 'Place 8 balls in a circle around a hole at exactly 3 feet. Make every putt. If you miss one start over. The goal is to complete the full circle without a miss.', tip: 'Most 3 footers are missed because of fear not technique. Holing hundreds of them in practice removes the fear completely.' },
    { name: 'The Metronome Drill', description: 'Develop a consistent putting tempo and rhythm', difficulty: 'Beginner', club: 'Putter', reps: '20 putts at each distance — 5, 10, and 20 feet', instructions: 'Use a metronome app set to 72 beats per minute. Make putting strokes with the backswing on one beat and the follow through on the next. Every stroke should be perfectly metronomic.', tip: 'The best putters in the world have the most consistent tempo. Rushing the stroke is the most common putting fault.' },
    { name: 'The One Hand Putting Drill', description: 'Build feel and control in each hand', difficulty: 'Beginner', club: 'Putter', reps: '30 putts (10 lead only, 10 trail only, 10 both)', instructions: 'Hit 10 putts with lead hand only. Then 10 with trail hand only. Then 10 with both, focusing on the feeling of whichever hand produced better results.', tip: 'Most right handed golfers are too right hand dominant causing the face to close through impact. Lead hand only putting trains a straighter face.' },
    { name: 'The Pre-Round Routine Putt', description: 'Groove your putting routine before every round', difficulty: 'Beginner', club: 'Putter', reps: '15 putts as a warmup', instructions: 'Hit 5 putts from 3 feet to get face feel. Then 5 putts from 20 feet focusing only on speed. Then 5 putts from 6 feet trying to make them. Walk to the first tee knowing the speed of the greens.', tip: 'The biggest mistake before a round is not putting at all or only hitting long putts. Start short, build feel, then roll a few longer ones.' },
    { name: 'The Eyes Closed Putting Drill', description: 'Develop feel and distance control putting', difficulty: 'Intermediate', club: 'Putter', reps: '20 putts from 20 feet', instructions: 'From 20 feet close your eyes after you read the putt and set up. Make your stroke by feel. Open your eyes after impact. Note how close your feel matched the actual result.', tip: 'Distance control in putting is pure feel. This drill develops that feel faster than any other because you are forced to trust your instincts.' },
    { name: 'The Ladder Drill — Putting', description: 'Master distance control from multiple distances', difficulty: 'Intermediate', club: 'Putter', reps: '12 putts (3 from each of 10, 20, 30, and 40 feet)', instructions: 'Place tees at 10, 20, 30, and 40 feet from the hole. Hit 3 putts from each distance trying to finish within 18 inches of the hole. Score 1 point for inside 18 inches and 0 for outside. Maximum score is 12.', tip: 'Three putts almost always come from poor distance control on the first putt not missed short putts. This drill eliminates three putts faster than any other.' },
    { name: 'The Gate and String Drill', description: 'Train a perfectly straight putting stroke', difficulty: 'Intermediate', club: 'Putter', reps: '30 putts', instructions: 'Stretch a string from the ball to the hole using two stakes at 4 feet. Place tees as a gate just wider than the putter at the ball. Make strokes keeping the putter directly below the string through impact.', tip: 'This drill removes all guesswork from straight putt technique. If you can make 30 in a row under the string your stroke is tour quality.' },
    { name: 'The Breaking Putt Reading Drill', description: 'Learn to read and commit to breaking putts', difficulty: 'Intermediate', club: 'Putter', reps: '20 breaking putts', instructions: 'Find a putt with at least 2 feet of break. Before putting predict the exact line and where the ball will enter the hole. Putt and compare your prediction to reality. Adjust your read and repeat.', tip: 'Green reading is a skill that improves with deliberate practice. Most amateurs undercorrect for break — play more break than you think.' },
    { name: 'The 100 Putt Challenge', description: 'Build consistency and confidence under volume', difficulty: 'Intermediate', club: 'Putter', reps: '100 putts (25 from 3, 6, 10, and 20 feet)', instructions: 'Hit 100 putts in one session — 25 from 3 feet, 25 from 6 feet, 25 from 10 feet, 25 from 20 feet. Count how many you make from each distance and track it week to week.', tip: 'Putting improves through volume. Most amateurs hit 10 putts and leave. Commit to 100 once a week and watch your putting average drop within a month.' },
    { name: 'The Tee in Ground Drill', description: 'Train a precise low point in your stroke', difficulty: 'Advanced', club: 'Putter', reps: '30 strokes', instructions: 'Push a tee into the grip end of your putter so it points at your belly button. Make putting strokes without the tee moving off your belt line. If it points left or right your hands are manipulating the putter.', tip: 'The best putters have zero manipulation. The putter swings like a pendulum with no hand action whatsoever.' },
    { name: 'The Pressure 18 Hole Putting Round', description: 'Simulate real round putting pressure', difficulty: 'Advanced', club: 'Putter', reps: '18 holes of putting', instructions: 'Play 18 holes of putting on the practice green. Pick 18 different holes and distances. Keep score — par is 2 putts per hole so par for 18 is 36. Count every putt honestly. Track your score week to week.', tip: 'Tour average putting round is approximately 28 to 30 putts. If you are over 36 your putting is costing you strokes. Under 32 is excellent amateur putting.' },
  ],
  'Golf Fitness': [
    { name: 'The Hip 90-90 Stretch', description: 'Improve hip mobility for a fuller turn', difficulty: 'Beginner', club: 'No Club', reps: '2 minutes each side', instructions: 'Sit on the floor with your front leg bent 90 degrees in front and your back leg bent 90 degrees behind you. Sit tall and hold for 60 seconds. Switch sides.', tip: 'Tight hips are the number one cause of restricted backswing in amateur golfers. 5 minutes of hip stretching daily will add 10 yards within 4 weeks.' },
    { name: 'The Thoracic Spine Rotation', description: 'Increase shoulder turn and rotation', difficulty: 'Beginner', club: 'No Club', reps: '20 rotations each direction', instructions: 'Sit on the floor with knees bent and feet flat. Place your hands behind your head. Rotate your upper body left and right as far as comfortable. Hold each end position for 2 seconds.', tip: 'Most amateurs rotate their lower back instead of their thoracic spine. This drill teaches the correct rotation source and protects your lower back.' },
    { name: 'The Glute Bridge', description: 'Build power and stability in your lower body', difficulty: 'Beginner', club: 'No Club', reps: '3 sets of 15', instructions: 'Lie on your back with knees bent and feet flat on the floor. Drive your hips up squeezing your glutes hard at the top. Hold for 2 seconds and lower slowly.', tip: 'Weak glutes cause early extension in the golf swing — the single most common swing fault in amateur golfers. Strong glutes eliminate it.' },
    { name: 'The Single Leg Balance Drill', description: 'Improve balance throughout your swing', difficulty: 'Beginner', club: 'No Club', reps: '30 seconds each leg, 3 rounds', instructions: 'Stand on one leg for 30 seconds with eyes open. Then repeat with eyes closed. Progress to standing on one leg and making a slow motion golf swing without falling.', tip: 'Balance is trainable. Golfers with poor balance hit more inconsistent shots because their foundation moves during the swing.' },
    { name: 'The Wrist and Forearm Strengthening Routine', description: 'Build clubhead speed and control', difficulty: 'Beginner', club: 'No Club', reps: '3 rounds', instructions: 'Three exercises back to back — 20 wrist curls with light dumbbell, 20 reverse wrist curls, 30 second rice bucket grip. Rest 60 seconds and repeat.', tip: 'Weak wrists cause the club to twist at impact producing inconsistent contact. Strong wrists maintain the face angle through the ball.' },
    { name: 'The Medicine Ball Rotation Throw', description: 'Train explosive rotational power', difficulty: 'Intermediate', club: 'Medicine Ball', reps: '3 sets of 10 each side', instructions: 'Stand sideways to a wall 3 feet away holding a light medicine ball. Rotate away from the wall then explosively rotate toward it throwing the ball against the wall. Catch and repeat.', tip: 'Golf power comes from rotational speed not arm strength. This drill trains the exact athletic movement pattern of the downswing.' },
    { name: 'The Pallof Press', description: 'Build core stability for a consistent swing', difficulty: 'Intermediate', club: 'Resistance Band', reps: '3 sets of 12 each side', instructions: 'Using a resistance band anchored at chest height stand sideways to the anchor. Hold the band at your chest and press straight out. Hold for 2 seconds. The band will try to rotate you — resist it.', tip: 'A stable core that resists rotation allows you to generate more rotational force through the ball. This is the single best core exercise for golfers.' },
    { name: 'The Lateral Band Walk', description: 'Strengthen hips for better weight transfer', difficulty: 'Intermediate', club: 'Resistance Band', reps: '3 sets of 15 each direction', instructions: 'Place a resistance band around your ankles. Stand in a slight squat position. Step sideways 15 steps to the right then 15 back to the left keeping tension in the band throughout.', tip: 'The lateral hip muscles stabilize your lower body during the backswing and downswing. Weak lateral hips cause swaying.' },
    { name: 'The Romanian Deadlift', description: 'Build posterior chain strength for more power', difficulty: 'Intermediate', club: 'Dumbbells', reps: '3 sets of 10', instructions: 'Hold dumbbells in front of your thighs. Hinge at the hips pushing them back while keeping your back flat. Lower the weights until you feel a stretch in your hamstrings then drive your hips forward to stand.', tip: 'The hip hinge pattern of the RDL is identical to the athletic posture at address. This exercise simultaneously builds strength and reinforces your setup.' },
    { name: 'The Cable or Band Wood Chop', description: 'Train the exact movement pattern of your swing', difficulty: 'Intermediate', club: 'Resistance Band', reps: '3 sets of 12 each direction', instructions: 'Using a cable machine or resistance band anchored high, stand sideways and pull the band diagonally from high to low across your body — mirroring the downswing pattern. Control the return.', tip: 'The wood chop is the closest gym exercise to the actual golf swing movement pattern. Add resistance gradually over weeks to build swing-specific power.' },
  ],
  'Course Management': [
    { name: 'The Club Selection Audit', description: 'Make smarter club choices on every shot', difficulty: 'Beginner', club: '9 Iron → Driver', reps: '10 balls per club', instructions: 'At the range hit 10 balls with every club from 9 iron to driver. Record the carry distance of the middle 6 shots (removing the best and worst 2). This is your real yardage — not your best shot yardage.', tip: 'Most amateurs overestimate their distances by 10 to 20 yards per club. Real yardages lead to better club selection and more greens in regulation.' },
    { name: 'The Layup Decision Drill', description: 'Know when to lay up and when to attack', difficulty: 'Beginner', club: 'Gap Wedge', reps: '10 shots', instructions: 'Pick a target that represents a smart layup — a full wedge distance from the green, away from hazards. Hit 10 shots to that exact target. The goal is precision to a comfortable yardage not maximum distance.', tip: 'The best layup shot is not always the longest. Train yourself to hit to your favorite approach distance whatever that is.' },
    { name: 'The Pre-Shot Routine Builder', description: 'Build a consistent pre-shot routine', difficulty: 'Beginner', club: '7 Iron', reps: '20 shots', instructions: 'Design a routine of exactly 4 steps — stand behind ball and visualize shot, pick an intermediate target 2 feet ahead, take your stance and set up, one look at the target then swing. Time it — it should take 20 to 25 seconds. Hit 20 shots using this exact routine every time.', tip: 'A consistent pre-shot routine is the most underrated skill in golf. It calms nerves, ensures proper alignment, and triggers automatic swings.' },
    { name: 'The Trouble Shot Library', description: 'Prepare for every difficult on-course situation', difficulty: 'Intermediate', club: '6 Iron', reps: '25 shots (5 of each type)', instructions: 'Practice 5 specific trouble shots — punch shot from under trees, high soft shot over obstacle, low running shot into wind, intentional draw around corner, intentional fade away from hazard.', tip: 'On the course you will face these shots under pressure. Practicing them in advance removes the panic and gives you a plan.' },
    { name: 'The Wind Adjustment Drill', description: 'Learn to adjust for wind conditions accurately', difficulty: 'Intermediate', club: 'Any Iron', reps: '30 shots in varying wind directions', instructions: 'On a windy day at the range hit each club into the wind, downwind, and crosswind. Note how much the wind affects carry and direction. Build your own wind adjustment chart.', tip: 'Most amateurs ignore wind completely or overcompensate wildly. Systematic wind adjustment separates consistent scorers from weather-dependent ones.' },
    { name: 'The Miss Side Drill', description: 'Always miss on the correct side of the hole', difficulty: 'Intermediate', club: '7 Iron', reps: '10 shots per scenario', instructions: 'Pick a target with trouble on one side (bunker left, water right). Before each shot decide which side is the safe miss. Aim to that side even if it means aiming away from the pin. Hit 10 shots.', tip: 'Course management is about avoiding your worst scores not chasing your best shots. Always know which side of every green is safe before you swing.' },
    { name: 'The Bogey Avoidance Drill', description: 'Eliminate the big numbers that wreck your score', difficulty: 'Intermediate', club: 'Driver', reps: '18 simulated shots', instructions: 'Play a simulated round on the range. For each hole pretend the safe play is 20 yards short of your normal distance. Hit that safe shot. Count how many times the safe play would have kept you in play versus your normal aggressive play.', tip: 'Eliminating double bogeys is worth more strokes per round than making more birdies. Safe golf beats hero golf for 95% of amateurs.' },
    { name: 'The Par 18 Strategy Game', description: 'Play smarter golf by thinking like a pro', difficulty: 'Advanced', club: 'Full Bag', reps: '18 virtual holes', instructions: 'Design 18 virtual holes using range targets as hazards and flags. For each hole plan your shot strategy before hitting — driver or iron off tee, what is the safe landing zone, what approach yardage do you want. Execute the plan and score yourself.', tip: 'Great ball strikers who make bad decisions shoot 85. Average ball strikers who make great decisions shoot 79. Strategy matters more than swing.' },
  ],
};

const DIFFICULTY_ORDER = ['Beginner', 'Intermediate', 'Advanced'];

// Find which skill area a drill belongs to
export function getDrillSkillArea(drillName) {
  for (const [area, drills] of Object.entries(DRILL_LIBRARY)) {
    if (drills.find(d => d.name === drillName)) return area;
  }
  return null;
}

// Get drill object from library by name
export function getDrillByName(drillName) {
  for (const drills of Object.values(DRILL_LIBRARY)) {
    const found = drills.find(d => d.name === drillName);
    if (found) return found;
  }
  return null;
}

// Get the club recommendation for a drill by name
export function getDrillClub(drillName) {
  const drill = getDrillByName(drillName);
  return drill?.club || null;
}

// Get the next harder drill in the same skill area
export function getHarderDrill(drillName, excludeNames = []) {
  const area = getDrillSkillArea(drillName);
  if (!area) return null;
  const current = getDrillByName(drillName);
  if (!current) return null;
  const currentIdx = DIFFICULTY_ORDER.indexOf(current.difficulty);
  const candidates = DRILL_LIBRARY[area].filter(d =>
    d.name !== drillName &&
    !excludeNames.includes(d.name) &&
    DIFFICULTY_ORDER.indexOf(d.difficulty) > currentIdx
  );
  if (candidates.length > 0) return candidates[0];
  const sameLevelCandidates = DRILL_LIBRARY[area].filter(d =>
    d.name !== drillName &&
    !excludeNames.includes(d.name) &&
    d.difficulty === current.difficulty
  );
  return sameLevelCandidates[0] || null;
}

// Reduce rep count by 20%
function reduceReps(repsStr) {
  return repsStr.replace(/\d+/g, (num) => {
    const reduced = Math.round(parseInt(num, 10) * 0.8);
    return String(reduced);
  });
}

/**
 * Generate a warmup club sequence for Range Day sessions based on skill weaknesses.
 * Returns an array of { club, balls } objects in order.
 */
export function getWarmupSequence(profile) {
  if (!profile) return null;

  const drivingRating = profile.skill_driving || 3;
  const ironRating = profile.skill_iron_play || 3;

  // Always start with wedge and work up
  const sequence = [
    { club: 'Pitching Wedge', balls: 10 },
    { club: '8 Iron', balls: 10 },
  ];

  // Add 6 iron or 5 iron depending on iron weakness
  sequence.push({ club: ironRating <= 2 ? '6 Iron' : '5 Iron', balls: 10 });

  // Add 3 wood or driver depending on driving weakness
  if (drivingRating <= 2) {
    sequence.push({ club: '3 Wood', balls: 10 });
    sequence.push({ club: 'Driver', balls: 15 });
  } else {
    sequence.push({ club: 'Driver', balls: 10 });
  }

  return sequence;
}

/**
 * Given a drill and the user's recent DrillRating history, apply progressive overload mutations.
 *
 * Fix 2: Mastery is now category-wide, not drill-specific.
 * If the user has 2+ Clicked ratings on ANY drills in the same skill area AND difficulty level
 * within the last 14 days, they are upgraded to a harder drill.
 *
 * Returns: { drill (possibly replaced), overloadStatus: 'up' | 'down' | 'same' }
 */
export function applyProgressiveOverload(drill, allDrillRatings) {
  const area = getDrillSkillArea(drill.name);
  const currentDrillData = getDrillByName(drill.name);
  if (!area || !currentDrillData) return { drill, overloadStatus: 'same' };

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  // Get all drills in the same area at the same difficulty level
  const drillsAtSameLevel = (DRILL_LIBRARY[area] || [])
    .filter(d => d.difficulty === currentDrillData.difficulty)
    .map(d => d.name);

  // Count Clicked ratings across ALL drills in same area+difficulty in last 14 days
  const recentClicked = allDrillRatings.filter(r => {
    if (!drillsAtSameLevel.includes(r.drill_name) || r.rating !== 'Clicked') return false;
    const d = parseDateLocal(r.session_date);
    return d && d >= cutoff;
  });

  if (recentClicked.length >= 2) {
    const harderDrill = getHarderDrill(drill.name);
    if (harderDrill) {
      return {
        drill: { ...harderDrill, _upgraded: true },
        overloadStatus: 'up',
      };
    }
  }

  // Struggled: check last 2 ratings on this specific drill
  const drillHistory = allDrillRatings
    .filter(r => r.drill_name === drill.name)
    .sort((a, b) => (parseDateLocal(b.session_date)?.getTime() ?? 0) - (parseDateLocal(a.session_date)?.getTime() ?? 0))
    .slice(0, 2);

  if (drillHistory.length >= 2 && drillHistory[0].rating === 'Struggled' && drillHistory[1].rating === 'Struggled') {
    return {
      drill: {
        ...drill,
        reps: reduceReps(drill.reps),
        _coachNote: 'Take your time with this one — consistency beats intensity.',
        _reduced: true,
      },
      overloadStatus: 'down',
    };
  }

  return { drill, overloadStatus: 'same' };
}