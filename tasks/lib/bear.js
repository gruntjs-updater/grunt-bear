exports.init = function (grunt) {
    'use strict';

    var fs = require('fs'),
        url = require('url'),
        handlebars = require('handlebars'),
        marked = require('marked'),
        path = require('path'),
        $ = require('jquery');

    // Set default options except highlight which has no default
    marked.setOptions({
        tables: true,
        breaks: false,
        pedantic: false,
        sanitize: true,
        smartLists: true,
        smartypants: true,
    });

    handlebars.registerHelper('equal', function(v1, v2, blocks) {
        if(v1 == v2) {
            return blocks.fn(this);
        } else {
            return blocks.inverse(this);
        }
    });

    var sortByDate = function( a, b ) {
        return new Date( b.metadata.Date ) - new Date( a.metadata.Date );
    }

    var hasChildren = function( dir ) {
        var children, i;

        if ( isDirectory( dir ) ) {
                children = fs.readdirSync( dir );
                for ( i = 0; i < children.length; i++ ) {
                        if ( isDirectory( path.join( dir, children[i] ) ) ) {
                                return true;
                        }
                }
        }
        return false;
    }

    var isDirectory = function( path ) {
        var stats = fs.statSync( path );
        return stats.isDirectory();
    }



var getNavigation = function( file ) {
        /*var nav = config.navigation,
                fileSplit = file.split( path.sep )[0],
                id = path.basename( fileSplit, path.extname( fileSplit ) );

        return nav.map( function( item ) {
                if ( id === item.name ) {
                        item.active = true;
                } else {
                        item.active = false;
                }

                // If URL is defined in config, take that one
                if ( item.url ) {
                        return item;
                }

                if ( item.name === '' ) {
                        item.url = '/';
                } else {
                        item.url = path.join( '/', item.name );
                }
                return item;
        });*/
    return [{name: 'test', url: 'test'}];
};



/*var createHome = function( options) {
        var tmpl = loadTemplate( 'index.html', options ),
                articles = listArticles( 'articles', options ).map( loadMarkdown ),
                projects = listArticles( 'projects', options ).map( loadMarkdown );

        return tmpl({
                //articles : articles.sort( sortByDate ),
                //config : config,
                articles: articles.sort( sortByDate ),
                projects: projects,
                navigation: getNavigation( '/' )
        });
}*/

    var exports = {};

    exports.registerPartials = function( options ) {
        grunt.log.writeln( options.templates );
        var partials,
            templates = fs.readdirSync( path.resolve ( options.templates ) );

        partials = templates.filter( function( item ) {
            if ( item[0] === '_' ) {
                return item;
            }
        });
        partials.forEach( function( partial ) {
            var name,
                s;

            grunt.log.writeln( 'Registering partial "' + name + '"' );

            name = path.basename( partial, '.html' );
            name = name.substr(1, name.length - 1);

            s = fs.readFileSync( path.resolve( options.templates, partial ), 'utf8' );
            handlebars.registerPartial( name, s );
        });
    };

    exports.deploy = function( files, options ) {

        var createIndex = function( type ) {
            grunt.log.writeln('Creating index for ' + type);
            var result,
                articles;

            articles = listArticles( type ).map( loadMarkdown );

            var tmpl = loadTemplate( path.join( type, 'index.html') );

            return tmpl({
                    articles : articles.sort( sortByDate ),
                    //config : config,
                    navigation: getNavigation( type )
            });
        };

        var listArticles = function( type ) {
            var files = fs.readdirSync( path.resolve( options.content, type ) );

            var dirs = files.filter(function( file ) {
                return isDirectory( path.resolve( options.content, type, file) );
            });

            return dirs.map( function( item ) {
                if ( fs.existsSync( path.resolve( options.content, type, item, item + '.md' ))) {
                        return path.join( type, item, item + '.md' );
                } else {
                        return path.join( type, item, 'index.md' );
                }
            });
        };

        var compile = function( templatePath, markdownPath ) {
            var tmpl,
                html;

            tmpl = loadTemplate( templatePath );
            html = loadMarkdown( markdownPath );

            return tmpl({
                    content: html.html,
                    meta: html.metadata,
                    //config: config,
                    navigation: getNavigation( markdownPath )
            });
        };

        var loadMarkdown = function( markdownFile ) {
            var markdown = fs.readFileSync( path.resolve( options.content + markdownFile ), 'utf8' );
            var html = {};

            html.html = marked( markdown );
            html.excerpt = $('<div>').html(html.html).find('p').first().html();
            html.url = path.join( '/', path.dirname( markdownFile ), '/' );

            return html;
        }

        var loadTemplate = function( templateFile ) {
            var tmpl = fs.readFileSync( path.resolve( options.templates + templateFile ), 'utf8');

            return handlebars.compile( tmpl );
        };

        var deployFile = function( file, i ) {
            var input,
                output,
                stats;

            input  = path.resolve( options.content, file );
            stats = fs.statSync( input );

            if ( stats.isDirectory() ) {
                // Create directory
                output = path.resolve( options.www, file );
                if ( fs.existsSync( output ) ) {
                        grunt.log.writeln( 'Directory exists: ' + output );
                } else {
                        grunt.log.writeln( 'Creating directory: ' + output );
                        fs.mkdir( output );
                }
                /*if ( hasChildren( input ) && file.split( path.sep ).length > 0 ) {
                        // Create Index
                        var type = path.dirname( file + '/' );
                        type = file;
                        fs.writeFileSync( path.join( output, 'index.html' ), createIndex( type ) );
                }*/
            /*} else if ( file === config.index ) {
                // Create home page
                output = path.resolve( options.www, 'index.html' );
                fs.writeFileSync( output, createHome() );*/
            } else if ( path.extname( file ) === '.md' && file.split( path.sep ).length > 1 ) {
                // Compile content page
                var templatePath,
                        type = path.dirname( file );
                templatePath = path.join( type, '..', 'single.html' );
                if ( !fs.existsSync( path.resolve( options.templates, templatePath ) ) ) {
                        templatePath = 'static.html';
                }
                output = path.resolve( options.www, path.dirname( file ), 'index.html' );
                grunt.log.writeln( 'CC '  + file /*+ ' -> ' + output + ' using ' + templatePath*/ );
                fs.writeFileSync( output, compile( templatePath, file ) );
            } else {
                // Copy any other file
                output = path.resolve( options.www, file );
                grunt.log.writeln( 'CP ' + file /*+ ' -> ' + output */);
                fs.writeFileSync( output, fs.readFileSync( input ) );
            }
        };

        files.forEach( deployFile );
    }

    return exports;
};
