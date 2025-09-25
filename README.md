## Installation

```sh
# once you have cloned the repo, switch to the multipong branch

$ git checkout multipong

# install the correct node version
nvm use 

# install dependencies
npm install

# run the server
node server.js
```

The server binds to 0.0.0.0:3000 which means you address it using whatever your machines ip address is on its current network. For example in my case: http://192.168.1.87:3000.

On a mac you can run `ifconfig` your current network address. 

There are two versions of the game you can access (im using my network address yours will be different):

### Multiplayer

http://192.168.1.87:3000 
This is the multiplayer version. You can share your network url with others on your local network for them to join the game and play multiplayer.
<img width="908" height="732" alt="image" src="https://github.com/user-attachments/assets/2b73f5b0-15c7-4162-9420-73de55ae2a62" />


### Triangle Pong - local only for now.

http://192.168.1.87:3000 
This is a re-imagined version that allows three players to play against each other. This version only works locally so three people on the same physcal maching using the same keyboard.
<img width="1097" height="864" alt="image" src="https://github.com/user-attachments/assets/a4501d14-f30d-4c36-b7bf-6deaa11e7f84" />

