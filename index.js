/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var ConstDependency = require("webpack/lib/dependencies/ConstDependency");
var NullFactory = require("webpack/lib/NullFactory");
var MissingLocalizationError = require("./MissingLocalizationError");

/**
 *
 * @param {object|function}	localization
 * @param {string}			functionName
 * @param {boolean}			failOnMissing
 * @constructor
 */
function I18nPlugin(opts) {
	this.localization = opts.localization ? ('function' === typeof opts.localization ?
		opts.localization : makeLocalizeFunction(opts.localization)) : null;
	this.pluralLocalization = opts.pluralLocalization ? ('function' === typeof opts.pluralLocalization ?
		opts.pluralLocalization : makeLocalizeFunction(opts.pluralLocalization)) : null;
	this.functionName = opts.functionName || "__";
	this.pluralFunctionName = opts.pluralFunctionName || "__n";
	this.failOnMissing = opts.failOnMissing || false;
}
module.exports = I18nPlugin;

I18nPlugin.prototype.apply = function(compiler) {
	var localization = this.localization,
		pluralLocalization = this.pluralLocalization,
		failOnMissing = this.failOnMissing;
	compiler.plugin("compilation", function(compilation, params) {
		compilation.dependencyFactories.set(ConstDependency, new NullFactory());
		compilation.dependencyTemplates.set(ConstDependency, new ConstDependency.Template());
	});

	var makeCallFunction = function(plural) {
		return function(expr) {
			var key = this.evaluateExpression(expr.arguments[0]).string;
			var localisationFunction = plural ? pluralLocalization : localization;
			var args = expr.arguments.map(this.evaluateExpression, this);
			args = args.map(function(arg) {
				if (arg.isString()) {
					return arg.string;
				} else if (arg.isNumber()) {
					return arg.number;
				} else {
					throw new Error("Invalid argument to __ or __n");
				}
			});
			var result = localization ? localisationFunction.apply(this, args) : key;
			if(typeof result == "undefined" || result === key) {
				var error = this.state.module[__dirname];
				if(!error) {
					error = this.state.module[__dirname] = new MissingLocalizationError(this.state.module, key, key);
					if (failOnMissing) {
						this.state.module.errors.push(error);
					} else {
						this.state.module.warnings.push(error);
					}
				} else if(error.requests.indexOf(key) < 0) {
					error.add(key, key);
				}
				result = key;
			}
			var dep = new ConstDependency(JSON.stringify(result), expr.range);
			dep.loc = expr.loc;
			this.state.current.addDependency(dep);
			return true;
		};
	};

	compiler.parser.plugin("call " + this.functionName, makeCallFunction(false));
	compiler.parser.plugin("call " + this.pluralFunctionName, makeCallFunction(true));

};

/**
 *
 * @param {object}	localization
 * @returns {Function}
 */
function makeLocalizeFunction(localization) {
	return function localizFunction(key) {
		return localization[key];
	};
}