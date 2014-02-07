/**
 * A simple storage connector plugin to the Parse REST interface.
 * 
 * Note: the plugin requires jQuery to be linked into the host page.
 * 
 * THIS PLUGIN IS FOR DEMO PURPOSES ONLY - DON'T USE IN A PRODUCTION
 * ENVIRONMENT.
 */

annotorious.plugin.Parse = function(opt_config_options) {
	/** @private * */
	this._APP_ID = opt_config_options['app_id'];
	this._JS_KEY = opt_config_options['js_key'];
	this._DEBUG = opt_config_options['debug'] || false;
	/** Use this attribute to filter the imageset for which the current instance is mandated to manage annotations 
	 *  if not set, all annotatable images will be manage by the current instance
	 *  may set to: 'file://' for development purposes
	 *  may set to: 'http://' to load annotations for all deployed images 
	 *  may set to: 'http://myapp/myimagefolder' to define the image set for which the current instance is responsible to manage annotations
	 *  may set to: 'none' to disable the annotations for test purposes
	 * * */
	this._PREFIX_IMG_URL = opt_config_options['prefix_img_url'];

	/** @private * */
	this._collection = null;
	/** @private * */
	this._loadIndicators = [];

	// initialize Parse
	Parse.$ = jQuery;
	Parse.initialize(this._APP_ID, this._JS_KEY);

	var Annotation = Parse.Object.extend("Annotation");
	var AnnotationCollection = Parse.Collection.extend({
		model : Annotation
	});
	this._collection = new AnnotationCollection();
};

annotorious.plugin.Parse.prototype.initPlugin = function(anno) {
	var self = this;

	anno.addHandler('onAnnotationCreated', function(annotation) {
		self._create(annotation);
	});

	anno.addHandler('onAnnotationUpdated', function(annotation) {
		self._update(annotation);
	});

	anno.addHandler('onAnnotationRemoved', function(annotation) {
		self._delete(annotation);
	});

	self._loadAnnotations(anno);
};

annotorious.plugin.Parse.prototype.onInitAnnotator = function(annotator) {
	var self = this;
	var spinner = this._newLoadIndicator();
	annotator.element.appendChild(spinner);
	this._loadIndicators.push(spinner);

	for ( var i = 0; i < this._collection.size(); i++) {
		annotation = this._collection.at(i);

		// load annotations for the given image (annotator)
		if (self._isOwnAnnotation(annotation) && !annotation.get("shape") && annotation.get("shapes")[0].geometry) {
			if (annotator.getItem()["src"] == annotation.get("src")) {
				self._DEBUG && console.log("resetting annotation", annotation);
				anno.addAnnotation(annotation.toJSON(), true);
			}
		}
	}
};

annotorious.plugin.Parse.prototype._newLoadIndicator = function() {
	var outerDIV = document.createElement('div');
	outerDIV.className = 'annotorious-parse-plugin-load-outer';

	var innerDIV = document.createElement('div');
	innerDIV.className = 'annotorious-parse-plugin-load-inner';

	outerDIV.appendChild(innerDIV);
	return outerDIV;
};

/**
 * @private
 */
annotorious.plugin.Parse.prototype._loadAnnotations = function(anno) {
	var self = this;
	var removeSpinner = function() {
		// Remove all load indicators
		jQuery.each(self._loadIndicators, function(idx, spinner) {
			jQuery(spinner).remove();
		});
	}

	this._collection.fetch({
		success : function(coll) {
			coll.each(function(annotation) {
				self._DEBUG && console.log("load success", annotation);
				if (self._isOwnAnnotation(annotation) && !annotation.get("shape")
						&& annotation.get("shapes")[0].geometry) {
						anno.addAnnotation(annotation.toJSON());
				}
			});
			removeSpinner();
		},
		error : function(coll, error) {
			self._DEBUG && console.log("load error", coll, error);
			removeSpinner();
		}
	});
};

/**
 * @private
 */
annotorious.plugin.Parse.prototype._create = function(annotation_data) {
	var self = this;
	var Annotation = Parse.Object.extend("Annotation");
	var annotation = new Annotation();
	annotation.save(annotation_data, {
		success : function(parseAnnotation) {
			self._DEBUG && console.log("create success", parseAnnotation);
			annotation_data.objectId = parseAnnotation.id;
			self._collection.add(annotation);
		},
		error : function(parseAnnotation, error) {
			self._DEBUG && console.log("create error", parseAnnotation, error);
		}
	});
};

/**
 * @private
 */
annotorious.plugin.Parse.prototype._update = function(annotation_data) {
	var self = this;
	var annotation = this._collection.get(annotation_data.objectId);
	delete annotation_data.objectId;
	annotation.save(annotation_data, {
		success : function(parseAnnotation) {
			self._DEBUG && console.log("update success", parseAnnotation);
			annotation_data.objectId = parseAnnotation.id;
		},
		error : function(parseAnnotation, error) {
			self._DEBUG && console.log("update error", parseAnnotation, error);
		}
	});
};

/**
 * @private
 */
annotorious.plugin.Parse.prototype._delete = function(annotation_data) {
	self = this;
	var annotation = this._collection.get(annotation_data.objectId);
	annotation.destroy({
		success : function(parseAnnotation) {
			self._DEBUG && console.log("delete success", parseAnnotation);
			// the model should be automatically removed from any collections
			// that was containing it.
		},
		error : function(parseAnnotation, error) {
			self._DEBUG && console.log("delete error", parseAnnotation, error);
		}
	});
};

/**
 * @private
 */
annotorious.plugin.Parse.prototype._isOwnAnnotation = function(annotation) {
	self = this;
	// filter out annotations that doesn't belong to the current deployment
	if (self._PREFIX_IMG_URL 
			&& annotation.get("src").indexOf(self._PREFIX_IMG_URL) < 0)
		return false;
	
	return true;
};
