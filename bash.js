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
  var server = http.createServer(function(req, res){ 
   res.writeHead(200, {'Content-Type': 'text/html'});
   res.end(indexTemplate);
  });
  server.listen(8000);

  var socket = io.listen(server); 
  socket.on('connection', function(client){
    child = child_process.spawn('bash');
    child.stdout.on('data', function(data) {
      data = String(data);
      var result = {};
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
      client.send(JSON.stringify(result));
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
        var messageParts = message.slice(0, message.length - 1).split(' ');
        var tabComplete = messageParts.pop();
        var option = '-f';
        if (messageParts.length == 0) {
          option = '-c';
        }
        command = 'compgen ' + option + ' ' + tabComplete + ';';
      } else {
        command = message;
      }
      command += 'echo pwd: `pwd`\n';
      child.stdin.write(command);
    });
    client.on('disconnect', function(){
      child.stdin.end();
    });
  });
}
