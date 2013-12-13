exports.init = function (grunt) {
    'use strict';

    var fs = require('fs'),
        url = require('url'),
        handlebars = require('handlebars'),
        metaMarked = require('meta-marked'),
        path = require('path'),
        $ = require('jquery'),
        wrench = require('wrench'),
        moment = require('moment');

    var renderer = new metaMarked.Renderer();

    renderer.image = function(href, title, text) {
        var imageUrl = url.parse( href );
        if ( !imageUrl.hostname ) {
            // TODO: wenn bild lokal, stelle domain + pfad voran. aber woher nehmen? muss irgendwie während compile eingreifen...
            //href = url.resolve(  )
        }
        return metaMarked.Renderer.prototype.image(href, title, text);
    };
    renderer.paragraph = function( text ) {
        // If paragraph contains only image, render image without surrounding paragraph
        if ( text.match( /^<img/ ) ) {
            console.log(text);
            return text;
        }
        return metaMarked.Renderer.prototype.paragraph( text );
    }

    metaMarked.setOptions({
        tables: true,
        breaks: false,
        pedantic: false,
        sanitize: false,
        smartLists: true,
        smartypants: true,
        renderer: renderer
    });

    /*

    renderer.paragraph = function( text ) {
        // If paragraph contains only image, render image without surrounding paragraph
        if ( /^!\[/.match(text) ) {
            return text;
        }
        return metaMarked.renderer.paragraph( text );
    }*/


    handlebars.registerHelper('equal', function(v1, v2, blocks) {
        if(v1 == v2) {
            return blocks.fn(this);
        } else {
            return blocks.inverse(this);
        }
    });

    handlebars.registerHelper('sortByDate', function(context, options) {
        var out, data;
        if (options.data) {
            data = handlebars.createFrame(options.data || {});
            data.sorted = context.sort( sortByDate );
        }
        out = options.fn(context, { data: data });;
        return out;
    });

    handlebars.registerHelper('date', function(dateString) {
        return moment( dateString ).format("MMMM YYYY");
    });

    var sortByDate = function( a, b ) {
        return new Date( b.meta.Date ) - new Date( a.meta.Date );
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

    var exports = {};

    exports.registerPartials = function( options ) {
        var partials,
            templates = fs.readdirSync( path.resolve ( options.templates ) );

        grunt.log.subhead( 'Registering partials' );

        partials = templates.filter( function( item ) {
            if ( item[0] === '_' ) {
                return item;
            }
        });
        partials.forEach( function( partial ) {
            var name,
                s;

            name = path.basename( partial, '.html' );
            name = name.substr(1, name.length - 1);

            grunt.log.ok( name );

            s = fs.readFileSync( path.resolve( options.templates, partial ), 'utf8' );
            handlebars.registerPartial( name, s );
        });
    };

    exports.deploy = function( files, options ) {

        var pages = [];

        var walkDirectory = function(filepath, obj) {
            var dir = fs.readdirSync( path.resolve( options.content, filepath ) );
            if ( dir.length > 0 ) {
                obj.subpages = [];
            }
            obj.path = filepath + '/';
            obj.url = url.resolve( options.domain, filepath );
            obj.template = findTemplate( filepath );
            for (var i = 0; i < dir.length; i++) {
                var name = dir[i];
                var target = path.join( filepath, name );

                var stats = fs.statSync( path.resolve( options.content, target ));
                if (stats.isFile()) {

                } else if (stats.isDirectory()) {
                    var page = {
                        slug: name
                    };
                    //obj.pages[i] = {};
                    if ( fs.existsSync( path.join( options.content, target, 'index.md' ) ) ) {
                        page.hasContent = true;
                        page.markdown = path.join( target, 'index.md' );
                        var html = loadMarkdown( page.markdown );

                        page.meta = html.meta;
                    }
                    walkDirectory(target, page);
                    obj.subpages.push( page );
                }
            }
        };
        // Creates an index of all the content
        var collectPages = function() {
            var pages = {};

            grunt.log.subhead( 'Collecting content' );

            walkDirectory( '', pages);
            grunt.log.debug(JSON.stringify(pages, null, 4));

            return pages;
        }

        var findTemplate = function( page ) {
            var isSingle = fs.existsSync( path.join( options.content, page, 'index.md' ) );
            //console.log(path.join( options.templates, page, 'index.md' ))

            var templatePath = path.join( page, isSingle ? '../single.html' : 'index.html')

            return templatePath;
        }

        var getNavigation = function( file ) {
            var nav = options.navigation,
                fileSplit = file.split( path.sep )[0],
                id = path.basename( fileSplit, path.extname( fileSplit ) );

            return nav.map( function( item ) {
                item.active = id === item.name;

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
            });
        };

        var compile = function( templatePath, markdownPath ) {
            var tmpl,
                html = {};

            tmpl = loadTemplate( templatePath );
            if ( markdownPath ) {
                html = loadMarkdown( markdownPath );
            }
            //html.url = path.join( '/', path.dirname( markdownPath ), '/' );
            //html.navigation = getNavigation( markdownPath );
            html.pages = pages;
            html.permalink = url.resolve( options.domain, path.dirname( markdownPath ) );
            //console.log( html.url);

            return tmpl( html );
        };

        var loadMarkdown = function( markdownFile ) {
            var markdown = fs.readFileSync( path.resolve( options.content, markdownFile ), 'utf8' );
            var html = metaMarked( markdown, {renderer: renderer} );

            // The EXCERPT is the first paragraph
            html.excerpt = $('<div>').html(html.html).find('p').first().html();

            return html;
        }

        var loadTemplate = function( templateFile ) {
            var tmpl = fs.readFileSync( path.resolve( options.templates, templateFile ), 'utf8');

            return handlebars.compile( tmpl );
        };

        var deployPage = function( page ) {
            grunt.log.ok( page.path );

            var output = path.join( options.www, page.path, 'index.html' );
            // Create directory, if not exists
            wrench.mkdirSyncRecursive( path.join( options.www, page.path ) );
            fs.writeFileSync( output, compile( page.template, page.hasContent ? page.markdown : undefined ) );

            // Copy assets

            var dir = fs.readdirSync( path.resolve(path.join( options.content, page.path )) );
            for (var i = 0; i < dir.length; i++) {
                var name = dir[i];
                var source = path.join( options.content, page.path, name );
                var target = path.join( options.www, page.path, name );
                //console.log(target);
                var stats = fs.statSync( path.resolve( source ));
                if (stats.isFile() && name !== 'index.md') {
                    //cp
                    var output = path.resolve( target );
                    fs.writeFileSync( output, fs.readFileSync( path.resolve( source ) ) );
                }
            }

            // Deploy sub-pages
            page.subpages.forEach( deployPage );
        };

        pages = collectPages();

        grunt.log.subhead( 'Compiling templates & copying assets' );
        deployPage( pages );
    };

    return exports;
};
