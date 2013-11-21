/*
 * grunt-bear
 * https://github.com/tvooo/grunt-bear
 *
 * Copyright (c) 2013 Tim von Oldenburg
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

    var wrench = require('wrench'),
        path = require('path');

    // Please see the Grunt documentation for more information regarding task
    // creation: http://gruntjs.com/creating-tasks

    var bear = require('./lib/bear').init(grunt);

    grunt.registerTask('bear', 'Compile a bunch of markdown files into HTML.', function() {
        // Merge task-specific and/or target-specific options with these defaults.
        var options = this.options({
            punctuation: '.',
            separator: ', '
        });

        bear.registerPartials( options );

        // Crawl through content, copy all images and style files and compile markdown files using the according templates
        var content = wrench.readdirSyncRecursive( path.resolve( options.content ) );
        bear.deploy( content, options )
    });

};
