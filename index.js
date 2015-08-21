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
	this.functionName = opts.functionName || "__";
	this.failOnMissing = opts.failOnMissing || false;
}
module.exports = I18nPlugin;

I18nPlugin.prototype.apply = function(compiler) {
	var localization = this.localization,
		failOnMissing = this.failOnMissing;
	compiler.plugin("compilation", function(compilation, params) {
		compilation.dependencyFactories.set(ConstDependency, new NullFactory());
		compilation.dependencyTemplates.set(ConstDependency, new ConstDependency.Template());
	});

	compiler.parser.plugin("call " + this.functionName, function(expr) {
		var key = this.evaluateExpression(expr.arguments[0]).string;
		var args = expr.arguments.map(this.evaluateExpression, this);
		args = args.map(function(arg) {
			if (arg.isString()) {
				return arg.string;
			} else if (arg.isNumber()) {
				return arg.number;
			} else {
				throw new Error("Invalid argument to __");
			}
		});
		var result = localization ? localization.apply(this, args) : key;
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
	});

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