var extend = require('lodash.assign');
var cp = require('child_process');
var es = require('event-stream');
var util = require('util');
module.exports = {
  parseRawCommit: parseRawCommit,
  getCommits: getCommits,
  latestTag: latestTag,
  getLatestTags: getLatestTags
};

//Get latest tag, or if no tag first commit
function latestTag(done) {
  //Get tags sorted by date
  cp.exec("git describe --tags `git rev-list --tags --max-count=1`", function(err, stdout, stderr) {
    if (err) {
      getFirstCommit(done);
    } else {
      done(null, String(stdout).trim());
    }
  });
}

function getLatestTags(done) {
    var tags = {
        'minor':false,
        'patch':false
    };

    cp.exec('git log --tags --simplify-by-decoration --pretty="format:%ai ||%d" | grep -i "tag:"', function(err, stdout, stderr) {
        if(!stderr && String(stdout).trim()) {
            var tag_list = String(stdout).trim().split('\n'),
                tag_line,
                tag_date,
                tag_info,
                tag_match;
            for(var tag_idx = 0; tag_idx < tag_list.length; tag_idx ++) {
                tag_line = tag_list[tag_idx];
                tag_date = tag_line.split(' || ')[0].trim();
                tag_info = tag_line.split(' || ')[1].trim();

                tag = tag_info.match(/tag: (v?[\d]+\.[\d]+\.[\d]+)/)[1];

                if(!tags['patch'])
                    tags['patch'] = {
                        'tag':tag,
                        'date':tag_date
                    };

                if(!tags['minor'] && tag.indexOf('.0', tag.length - 2) !== -1) {
                    tags['minor'] = {
                        'tag':tag,
                        'date':tag_date
                    };
                    break;
                }
            }
        }

        done(null, tags);
    })
}

function getFirstCommit(done) {
  //Error --> no tag, get first commit
  cp.exec('git log --format="%H" --pretty=oneline --reverse', function(err, stdout, stderr) {
    if (stderr || !String(stdout).trim()) {
      done('No commits found!');
    } else {
      done(null, String(stdout).split('\n')[0].split(' ')[0].trim());
    }
  });
}

function filterExists(data, cb) {
  if (data) cb(null, data);
  else cb();  //get rid of blank lines
}

function getCommits(options, done) {
  options = extend({
    grep: '^feat|^(bug)?fix|^refactor|BREAKING',
    format: '%H%n%s%n%cN%n%b%n==END==',
    from: '',
    to: 'HEAD'
  }, options || {});

  var cmd = 'git log --grep="%s" -E --format=%s %s';
  cmd = util.format(
    cmd,
    options.grep,
    options.format,
    options.from ? options.from+'..'+options.to : ''
  );

  return es.child(cp.exec(cmd))
    .pipe(es.split('\n==END==\n'))
    .pipe(es.map(function(data, cb) {
      var commit = parseRawCommit(data, options);
      if (commit) cb(null, commit);
      else cb();
    }))
    .pipe(es.writeArray(done));
}

var COMMIT_PATTERN = /^(\w*)(\(([\w\$\.\-\*]*)\))?\: (.*)$/;
var MAX_SUBJECT_LENGTH = 100;
function parseRawCommit(raw, options) {
  if (!raw) {
    return null;
  }

  var lines = raw.split('\n');
  var msg = {}, match;

  msg.hash = lines.shift();
  msg.subject = lines.shift();
  msg.committer = lines.shift();
  msg.closes = [];
  msg.breaks = [];

  msg.subject = msg.subject.replace(/\s*(?:Closes|Fixes)\s#(\d+)/, function(_, i) {
    msg.closes.push(parseInt(i, 10));
    return '';
  });

  lines.forEach(function(line) {
    match = line.match(/(?:Closes|Fixes)\s((?:#\d+(?:\,\s)?)+)/);

    if (match) {
      match[1].replace(/[\s#]/g, '').split(',').forEach(function(i) {
        msg.closes.push(parseInt(i, 10));
      });
    }
  });

  match = raw.match(/BREAKING CHANGE:\s([\s\S]*)/);
  if (match) {
    msg.breaks.push(match[1]);
  }

  msg.body = lines.join('\n');
  match = msg.subject.match(COMMIT_PATTERN);

  if (!match || !match[1] || !match[4]) {
    return null;
  }

  if (match[4].length > MAX_SUBJECT_LENGTH) {
    match[4] = match[4].substr(0, MAX_SUBJECT_LENGTH);
  }

  msg.type = match[1];
  msg.component = match[3];
  msg.subject = match[4];

  return msg;
}
