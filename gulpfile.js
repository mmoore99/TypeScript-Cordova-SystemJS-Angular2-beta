/// <binding BeforeBuild='copy.htmlfiles.to.www' />
'use strict';


var gulp = require('gulp');
var tsd = require('gulp-tsd');
var tslint = require('gulp-tslint');
var browserSync = require('browser-sync');
var del = require('del');
var plugins = require('gulp-load-plugins')();
var gulptypescript = require('gulp-typescript');
var karma = require('karma');
var sourceMaps = require('gulp-sourcemaps');
var fs = require('fs');
var webdriver = require('gulp-protractor').webdriver_update;

gulp.task('NPM+NODE.version', function (done) {
    // adding require here so it doesn't run every time the gulpfile.js is loaded and run.
    var checkEnvironment = require('./tools/check-environment.js');
    checkEnvironment({ requiredNpmVersion: '>=2.14.7 <3.0.0', requiredNodeVersion: '>=4.2.1 <5.0.0' }, done);
});

gulp.task('install.tsd.files', function (callback) {
    tsd({
        command: 'reinstall',
        config: '.tsd.json'
    }, callback);
});

gulp.task('lint.typescript', function () {
    // Rules can be found here
    // https://github.com/palantir/tslint#supported-rules
    // Microsoft Rules = https://github.com/Microsoft/tslint-microsoft-contrib/blob/master/tslint.json
    var tslintConfig = require('./tools/tslint.json');
    return gulp.src(['scripts/**/*.ts', '!scripts/typings/**'])
        //Custom rules can be added to configuration.  rulesDirectory: 'folder/folder'
      .pipe(tslint({
          configuration: tslintConfig
      }))
      .pipe(tslint.report('verbose', { emitError: true, reportLimit: 0 }));

});

gulp.task('copy.htmlfiles.to.www', gulp.series(
    copyHTMLToWWW
));

//gulp.task('browser.sync.js-watch', ['js'], browserSync.reload);

gulp.task('browser.sync', function () {
    browserSync.init({
        server: {
            baseDir: "./www/"
        }
    });
    // add browserSync.reload to the tasks array to make
    // all browsers reload after tasks are complete.
    //gulp.watch("./www/scripts/*.js", ['browser.sync.js-watch']);
});

// remove the karma folder.
function karmaClean() {
    //You can use multiple globbing patterns as you would with `gulp.src`
    //If you are using del 2.0 or above, return its promise
    return del(['.karma']);
}



// remove the test folder in scripts.
function unitClean() {
    //You can use multiple globbing patterns as you would with `gulp.src`
    //If you are using del 2.0 or above, return its promise
    return del(['www/scripts/tests']);
}

function karmaTsSpec() {
    // takes the .ts files and converts to .js
    return karmaTs('scripts/tests/unit');
}

function ts(filesRoot, filesGlob, filesDest, project) {
    var results = gulp.src(filesGlob)
        .pipe(plugins.sourcemaps.init())
		.pipe(plugins.typescript(project))

    return results.js
        .pipe(plugins.sourcemaps.write())
        .pipe(gulp.dest(filesDest))
}

function karmaTs(root) {
    var project = plugins.typescript.createProject('./scripts/tsconfig.json', {
        outDir: '.karma'
    });

    var filesRoot = root;
    var filesDest = '.karma';
    var filesGlob = [
		root + '/**/*.ts'
    ];
    return ts(filesRoot, filesGlob, filesDest, project);
}

function convertTSJS() {
    var tsconfigPath = './scripts/tsconfig.json';
    return gulp.src(['./scripts/**/*.ts', '!./scripts/typings/*'])
        .pipe(gulptypescript(gulptypescript.createProject(tsconfigPath)))
        .pipe(gulp.dest("www/scripts"));
}

function copyHTMLToWWW() {
    return gulp.src(['./scripts/**/*.html'])
    .pipe(gulp.dest('./www/scripts/'));
}

/**
 * This is used by the travis.yml file to compile the .ts files into .js before running the unit test.
 */
gulp.task("build.appfiles.typescript", gulp.series(
    convertTSJS,
    copyHTMLToWWW
));

function karmaRun(done) {
    return new karma.Server({
        configFile: __dirname + '/tools/karma.conf.js'
    }, done).start();
}

gulp.task('post.build.cleanup', gulp.series(
    unitClean
));


//remove the protractor folder
function protractorClean(){
    return del(['.protractor']);
}

// Locate the protractor .ts files, convert to .js and save to .protractor folder
function protractorTs2Js() {
    var protractorTsProject = plugins.typescript.createProject('./scripts/tsconfig.json', {
        outDir: '.protractor',
        module: 'commonjs'
    });
    var filesRoot = 'scripts/tests/e2e';
    var filesDest = `.protractor/${filesRoot}`;
    var filesGlob = [
		`${filesRoot}/**/*.ts`
    ];

    return ts(filesRoot, filesGlob, filesDest, protractorTsProject);
}

/**
 * Ensures the selenium web drivers are installed
 * Updates selenium standalone
 * Updates chromedriver
 */
function protractorUpdate(done) {
    webdriver({}, done);
}

/**
 * Setup the test
 */
function protractorRun(cb) {
    // use return and delete cb
    gulp.src('.protractor/scripts/tests/e2e/**/*.spec.js')
		.pipe(plugins.protractor.protractor({
		    configFile: './tools/protractor.conf.js'
		}))
		.on('error', e => { throw e })
        .on('end',cb)
}

/**
 * copy all www files to .protractor
 */
function copyWWWToProtractor() {
    return gulp.src(['./www/**', '!./www/scripts/tests/**'])
    .pipe(gulp.dest(".protractor/"));
}

gulp.task('unit.test.karma', gulp.series(
    // Remember take in a callback or return a promise or event stream to avoid gulp 'The following tasks did not complete.'
    //clear the karma folder
    //karmaClean,
    // convert the .ts files to .js and save in karma folder
    //karmaTsSpec,
    // run the karma server
    karmaRun
));

/**
 * Steps:
 * Delete the .protractor folder.
 * Convert .ts files to .js and save to .protractor folder.
 */
gulp.task('e2e.test.protractor', gulp.series(
	protractorClean,
    copyWWWToProtractor,
	protractorTs2Js,
	protractorUpdate,
	protractorRun,
	protractorClean
));