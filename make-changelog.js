#!/usr/bin/env node

var fs = require('fs'),
	changelog = require('flowz-changelog'),
	program = require('commander');
// var request = require('request');

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

program
    .option('-f, --from <from>', 'Last changelog date, commit or tag.  If the "file" ' +
        'option is used and "since" is not provided, the mtime of the output ' +
        'file will be used. Otherwise, defaults to the last tag or first commit.')
    .option('-t, --to <to>', 'When should the changelog end. Defaults to HEAD. ' +
         'Also accepts a time or a commit hash.')
    .option('-O, --output <filename>', 'Output file.  If the file exists, ' +
        'log will be prepended to it.  Default is to write to stdout.')
	.option('-c, --codename <subtitle>', '')
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

changelog(options, function(error, changelog) {
	console.log(changelog || '');
});

/*
changelog({
	version: "0.0.1",
	subtitle: '"Chief"',
	repository: 'https://github.com/flowz-io/flowz-ui'
}, function(err, log) {
	if (err) throw new Error(err);
	fs.writeFileSync('CHANGELOG.md', log);
});
*/
