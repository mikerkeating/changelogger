from pygithub3 import Github
import simplejson
import re
import base64
import hashlib
import os
import datetime

from Naked.toolshed.shell import muterun_js

access_token = os.environ.get('CHANGEBOT_ACCESS_TOKEN')
commit_hash = os.environ.get('CIRCLE_SHA1')
current_user = os.environ.get('CIRCLE_PROJECT_USERNAME')
current_repo = os.environ.get('CIRCLE_PROJECT_REPONAME')
current_branch = os.environ.get('CIRCLE_BRANCH')
current_changelog = 'CHANGELOG.current.md'
full_changelog = 'CHANGELOG.md'

# This only supports x.x.x version numbers.

bump_regex = re.compile('\\[\\[BUMP:(MAJOR|MINOR|PATCH|v?\\d+\\.\\d+\\.\\d+)(:[a-zA-Z0-9 _-]+)?\\]\\]')
sha1_regex = re.compile('^[a-z0-9]{40}$')

gh = Github(token=access_token, user=current_user, repo=current_repo)

dthandler = lambda obj: (obj.isoformat() if isinstance(obj, datetime.datetime) or isinstance(obj, datetime.date) else None)

def create_update_file(file_path, contents, message, prepend=False):
    commit_data = False
    if os.path.isfile(file_path):
        sha1 = hashlib.sha1()

        with open(file_path) as f:
            file_contents = f.read()
            sha1.update("blob %u\0" % len(file_contents))
            sha1.update(file_contents)
            if prepend:
                contents = contents + "\n" + file_contents
        commit_data = gh.repos.contents.update(file_path, {
            'path':file_path,
            'message':message,
            'content':base64.b64encode(contents),
            'branch':current_branch,
            'sha':sha1.hexdigest()
        })
    else:
        commit_data = gh.repos.contents.create(file_path,{
            'path':file_path,
            'message':message,
            'content':base64.b64encode(contents),
            'branch':current_branch
        })

    return commit_data

print "access_token: " + access_token
print "commit_hash: " + commit_hash
print "current_user: " + current_user
print "current_repo: " + current_repo
print "current_branch: " + current_branch
print "current_changelog: " + current_changelog
print "full_changelog: " + full_changelog

commit_data = gh.git_data.commits.get(commit_hash)

commit_author = commit_data.committer.name
commit_message = commit_data.message

bump_message = bump_regex.search(commit_message)

if bump_message:
    bump_components = bump_message.group().strip('[]').split(':')
    bump_version = bump_components[1]
    bump_codename = False
    new_version = False
    old_version = 'v0.0.0'
    has_v = False
    if len(bump_components) == 3:
        bump_codename = bump_components[2]

    releases = gh.repos.releases.list().all()
    for release in releases:
        old_version = release.tag_name
        break

    if bump_version in ['MAJOR','MINOR','PATCH']:
        if old_version[0:1] == 'v':
            has_v = True

        exploded_version = old_version.strip('v ').split('.')

        if bump_version == 'MAJOR':
            exploded_version[0] = str(int(exploded_version[0]) + 1)
        elif bump_version == 'MINOR':
            exploded_version[1] = str(int(exploded_version[1]) + 1)
        elif bump_version == 'PATCH':
            exploded_version[2] = str(int(exploded_version[2]) + 1)

        new_version = ('v' if has_v else '') + '.'.join(exploded_version)
    else:
        new_version = bump_version

    release_name = new_version
    if bump_codename:
        release_name += ' "'+bump_codename+'"'

    argument_str = '--tag_version '+new_version

    if bump_codename:
        argument_str += '--codename \''+bump_codename+'\''


    changelog = muterun_js('build_files/changelogger/make-changelog.js', argument_str)

    changelog_str = ''
    if changelog.exitcode == 0:
        changelog_str = changelog.stdout
    else:
        print "[Changelog Error] ExitCode: " + str(changelog.exitcode) + ", Error Message: " + str(changelog.stderr)
        exit(1)

    cl_commit = False

    print "Generated ChangeLog: " + changelog_str

    create_update_file(current_changelog, changelog_str, 'chore(changelog): flowz-changebot create '+current_changelog+' for Release '+new_version)
    cl_commit = create_update_file(full_changelog, changelog_str, 'chore(changelog): flowz-changebot create '+full_changelog+' for Release '+new_version, True)

    commit_sha = cl_commit.commit['sha']

    # Needs to be done after changelog is created.

    gh.repos.releases.create({
        'tag_name':new_version,
        'target_committish':commit_sha,
        'name':release_name,
        'body':changelog_str
    })
else:
    print "No bump message found."
# Bump Message: [[BUMP:MAJOR]] OR [[BUMP:MINOR]] OR [[BUMP:PATCH]] OR [[BUMP:x.x.x]] OR [[BUMP:WHATEVER:Codename]]
