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