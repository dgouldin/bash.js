var http = require('http'),
    io = require('socket.io'),
    fs = require('fs'),
    child_process = require('child_process');

var indexTemplate;
fs.readFile('templates/index.html', function(err, data) {
  indexTemplate = data;
  start();
});

function start() {
  var cwdCommand = 'echo pwd: `pwd`\n';

  var server = http.createServer(function(req, res){ 
   res.writeHead(200, {'Content-Type': 'text/html'});
   res.end(indexTemplate);
  });
  server.listen(8000);

  var socket = io.listen(server); 
  socket.on('connection', function(client){
    var commandType = null;

    child = child_process.spawn('bash');
    child.stdout.on('data', function(data) {
      var sendCwd = false;
      var result = {};
      data = String(data);
      if (commandType == 'tabCompletion') {
        var lines = data.split('\n');
        lines.pop(); // always one extra newline
        if (lines.length == 1) {
          result = {
            result: 'complete',
            output: lines[0]
          }
        } else {
          result = {
            result: 'success',
            output: lines.join('\t')
          }
          sendCwd = true;
        }
      } else {
        if (data.indexOf('pwd: ') == 0) {
          var cwd = data.replace('pwd: ', '').replace(process.env.HOME, '~');
          result = {
            result: 'cwd',
            output: cwd
          };
        } else {
          result = {
            result: 'success',
            output: data
          };
        }
      }
      commandType = null;
      client.send(JSON.stringify(result));
      if (sendCwd) {
        child.stdin.write(cwdCommand);
      }
    });
    child.stderr.on('data', function(data) {
      client.send(JSON.stringify({
        result: 'error',
        output: String(data)
      }));
    });

    client.on('message', function(message){
      var command;
      if (message.charAt(message.length - 1) == '\t') {
        commandType = 'tabCompletion'
        var messageParts = message.slice(0, message.length - 1).split(' ');
        var tabComplete = messageParts.pop();
        var option = '-'
        if (messageParts.length == 0) {
          option += 'c';
        } else {
          option += 'f'
        }
        command = 'compgen ' + option + ' ' + tabComplete + '\n';
      } else {
        command = message + cwdCommand;
      }
      child.stdin.write(command);
    });
    client.on('disconnect', function(){
      child.stdin.end();
    });
  });
}
