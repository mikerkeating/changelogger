// Sys
var fs = require('fs'),
    path = require('path');
// Third Party

var git = require('./lib/git'),
    writer = require('./lib/writer'),
    extend = require('lodash.assign'),
    Github = require('github'),
    async = require('async'),
    handlebars = require('handlebars'),
    program = require('commander');

/*
 * OPTIONS: ( Supports both command-line usage and import usage.)
 *    from - Where to start the changelog. Defaults to last tag OR start of the repo.
 *    to - Where to finish the changelog. Defaults to HEAD
 *    output - Where to output the changelog. Defaults to "CHANGELOG.md", can specify file path or set to false to output to console.
 *    subtitle -
 */

var default_options = {
    tag_version: null,
    from: null,
    to: 'HEAD',
    output: 'CHANGELOG.md',
    subtitle: '',
    template: null,
    mode: 'commits',

    owner: null,
    repo: null,
    token: null,
    username: null,
    password: null,
    merged: null,
    header: null,
    log: console.log.bind(console),
}

if(!module.parent) {
    program
        .option('-f, --from <from>', 'Last changelog date, commit or tag.  If the "file" ' +
            'option is used and "since" is not provided, the mtime of the output ' +
            'file will be used. Otherwise, defaults to the last tag or first commit.')
        .option('-t, --to <to>', 'When should the changelog end. Defaults to HEAD. ' +
             'Also accepts a time or a commit hash.')
        .option('-O, --output <filename>', 'Output file.  If the file exists, ' +
            'log will be prepended to it.  Default is to write to stdout.')
        .option('-h, --template <path>', 'Handlebar template to format data.' +
            'The default bundled template generates a list of changes in Markdown')
        .option('-m, --mode', 'The mode in which to generate the changelog. Choose ' +
            'between "commits" and "issues". Defaults to "commits".')
        .option('-v, --tag_version <tag_version>', 'The version that this changelog marks. Example: ' +
            'v1.0.0')
        .option('-o, --owner <name>', '(Issues) Repository owner name.  If not provided, ' +
            'the "username" option will be used.')
        .option('-r, --repo <repo>', '(Issues) Repository name.')
        .option('-T, --token <token>', '(Issues) Your GitHub access token (only required ' +
            'for private repos & if you are using issues for your changelog).')
        .option('-u, --username <username>', '(Issues) Your GitHub username (only required ' +
            'for private repos & if you are using issues for your changelog).')
        .option('-p, --password <pass>', '(Issues) Your GitHub password (only required ' +
            'for private repos & if you are using issues for your changelog).')
        .option('-M, --merged', '(Issues) List merged pull requests only.')
        .option('-e, --header <header>', 'Header text.  Default is "Changes ' +
            'since <since>".')
        .parse(process.argv);

    var options = {};

    for(var key in default_options) {
        if(typeof program[key] !== 'undefined')
            options[key] = program[key];
    }

    generate(options, function(error, changelog) {
        console.log('Errors: ', error);
        console.log('Changelog: ', changelog);
    });
} else {
    module.exports = generate;
}

function generate(options, done) {
    options = extend(default_options, options || {});

    if (!options.tag_version)
        return done('No version specified');

    if(options.tag_version.indexOf('.0.0', options.tag_version.length - 4) === -1) {
        git.getLatestTags(function(err, tags) {
            if(tags['patch'])
                options['latest_patch'] = tags['patch'];

            if(tags['minor'])
                options['latest_minor'] = tags['minor'];
        });
    }

    git.latestTag(function(err, tag) {
        if (err || !tag)
            return done('Failed to read git tags.\n'+err);
        getChangelogCommits(tag);
    });

    function getChangelogCommits(latestTag) {
        options.from = options.from || latestTag;
        options.to = options.to || 'HEAD';

        git.getCommits({
            from: options.from,
            to: options.to,
        }, function(err, commits) {
            if (err)
                return done('Failed to read git log.\n'+err);
            writeLog(commits);
        });
    }

    function writeLog(commits) {
        writer.writeLog(commits, options, function(err, changelog) {
            if (err)
                return done('Failed to write changelog.\n'+err);

            if (options.file && fs.existsSync(options.file)) {
                fs.readFile(options.file, {encoding:'UTF-8'}, function(err, contents) {
                    if (err)
                        return done('Failed to read ' + options.file + '.\n'+err);
                    done(null, changelog + '\n' + String(contents));
                });
            } else {
                done(null, changelog);
            }
        });
    }
}
