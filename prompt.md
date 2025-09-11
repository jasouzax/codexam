This Deno app is a coding competition application

### Process
1) Host/Admin runs the application in the terminal hosting the interface on LAN
2) Participants enter the LAN IP and is greeted with the HOME page (`#home`) and must provide their names, and what language they are competiting for, and then click "Apply" which is then changed to "Waiting..."
3) The host receives a confirmation message in the CLI to accept or decline the application
4) Once accepted the participant's Apply button is removed and a text telling the participant to wait is displayed
5) Once the competition starts the Home page is is hidden revealing the arena
6) The participants can switch between different problems at `#tabs`, the problem description is shown at `#info`, the code is to be typed at `#code`, and the current problem status is in the `#result`
7) In the `#result` all the test cases are shown here, the participant can either click "Test" which only test the current test case, or click "Submit" which tests all the testcases, or click "Finish" which hides the arena by overlaying the `#wait` element to wait for the competition to end or go back to arena
8) Every testcase is submited to the host which runs the code in their respective programming language, Deno executes the code in their respective compiler/interpreter and collects the output and is compared to the expected output, if equal then test case is marked correct and the user can move up the leaderboard(by highest score not current score). If the code is different from the previous testcase then the score is reseted
9) The results of the host is sent back to the client which displays any output difference from the expected output in `#result`'s `#match`. The difference is marked with red background
10) After the competition ends the user is forced to `#over` page and the leader board is displayed, the host stops accepting testcases

### Leaderboard
Each programming language has their own leaderboard based on points, each challenge/problem have their own maximum points attainable (points for each testcase). A participant has two scores, the maximum score they have reached, and the current score they have. The maximum score is what is used in the leaderboard, and if two people have the same maximum score then the rank is based on who achieved it first. If a code is different in a test case the the previous test cases of the same problem is removed from the current score, this is why there are two different score system.

### Design
- `#title` - Displays the event title and is visible no matter what
- `#tabs` - Tabs to switch between different challenges/problems
- `#info` - Problem statement
- `#code` - Participant's code
- `#result` - Testcase area
  - `#case` - Button to switch between different testcase, the button is also decorated based on if the test case passed or failed
  - `#match` - Displays all differences between expected output and actual output
  - `#action` - Actions to test single case, test all cases, and wait for end.
- `#time` - Countdown for start of competition, or end of competition, or if over
- `#home` - Home page displayed if the competition hasnt started yet for participants to apply
- `#wait` - Just a page for participant to hide the arena normally to wait for the competition to end
- `#over` - Page displayed if the competition is ended or is ongoing (not pariticipants)
- `#div_l` and `#div_r` - Just draggable divs to move the body's grid

### Todo
- Instead of putting the problems static, give a template variable containing the challenge's name, problem statement in HTML, and test cases (each has points, and expected output). Like maybe a variable named `challenges`
- Design the interface, our school uses Red, Black, White has the main color palette
- If you have any questions please ask before making the code

### Grok improve
While everything is mostly working, here are some suggested fixes:
- I have to type "y" twice if I want to accept an application, fix this
- For CLI I suggest that while "start" starts the competition immegetly, "start 10:30" sets the datetime to start. Same with "end 13:00"
- For people who opened the website while the competition is ongoing should be shown `#over` not `#home` so they can see the current leaderboard
- Please try to make the code more compact, like there is alot of `document.getElementById` which could be make into an `id` function or even a `$` to query select, just make the code more readable, compact, and less redundant
- `Deno.run` was removed in Deno 2
- Code difference checker is not working because it is labeling `\r` has the difference
- If the websocket disconnected the `#time` should display "connect..." or something similar
- Please add a new element located bottom of `#info` and top of `#time` but not overlaying it, that displays the participants total current score

### Grok improve #2
- Setting `start` and `end` date doesnt change participant's time message, like still saying "Waiting for start" despite setted new start date, similarly the time left doesnt change when set "end". Also if a start date is moved to the future while the competition is ongoing that means the competition is rescheduled/restarted so restart all competitor's scores, etc. The `duration` is just the default if end time is null
- When submitting code, the result code output is empty so the external command is not working properly, this is the error:
  TypeError: proc.stdin.write is not a function
    at runCode (file:///C:/Users/jason/Desktop/codexam/codexam_grok:290:22)
    at eventLoopTick (ext:core/01_core.js:179:7)
    at async file:///C:/Users/jason/Desktop/codexam/codexam_grok:374:35
- Please transfer `span` style of `#match` to inside the style not on the element for better readability and compactness
- `startTime` and `scheduledStart`, and `endTime` and `scheduledEnd` seemed redundant that even my IDE is warning that `scheduledEnd` is never read
- Use `{}` brackets inside of `switch` cases
- The draggable `#div_l` and `#div_r` is too sensitive that when I draw my mouse right of it it moved faster then my mouse loosing contact with my mouse same with both
- For current score, instead of just the current total score of the user display current score over total possible score so that the user can know how much more is left