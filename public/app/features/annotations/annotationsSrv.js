define([
  'angular',
  'lodash',
  'moment',
  './editorCtrl'
], function (angular, _, moment) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('annotationsSrv', function(datasourceSrv, $q, alertSrv, $rootScope, $sanitize) {
    var promiseCached;
    var list = [];
    var timezone;
    var self = this;

    this.init = function() {
      $rootScope.onAppEvent('refresh', this.clearCache);
      $rootScope.onAppEvent('setup-dashboard', this.clearCache);
    };

    this.clearCache = function() {
      promiseCached = null;
      list = [];
    };

    this.getAnnotations = function(rangeUnparsed, dashboard) {
      if (dashboard.annotations.list.length === 0) {
        return $q.when(null);
      }

      if (promiseCached) {
        return promiseCached;
      }

      timezone = dashboard.timezone;
      var annotations = _.where(dashboard.annotations.list, {enable: true});

      var promises  = _.map(annotations, function(annotation) {
        return datasourceSrv.get(annotation.datasource).then(function(datasource) {
          return datasource.annotationQuery(annotation, rangeUnparsed)
            .then(self.receiveAnnotationResults)
            .then(null, errorHandler);
        }, this);
      });

      promiseCached = $q.all(promises)
        .then(function() {
          return list;
        });

      return promiseCached;
    };

    this.receiveAnnotationResults = function(results) {
      for (var i = 0; i < results.length; i++) {
        addAnnotation(results[i]);
      }
    };

    function errorHandler(err) {
      console.log('Annotation error: ', err);
      var message = err.message || "Annotation query failed";
      alertSrv.set('Annotations error', message,'error');
    }

    function addAnnotation(options) {
      var title = $sanitize(options.title);
      var tooltip = "<small><b>" + title + "</b><br/>";
      if (options.tags) {
        var tags = $sanitize(options.tags);
        tooltip += '<span class="tag label label-tag">' + (tags || '') + '</span><br/>';
      }

      if (timezone === 'browser') {
        tooltip += '<i>' + moment(options.time).format('YYYY-MM-DD HH:mm:ss') + '</i><br/>';
      }
      else {
        tooltip += '<i>' + moment.utc(options.time).format('YYYY-MM-DD HH:mm:ss') + '</i><br/>';
      }

      if (options.text) {
        var text = $sanitize(options.text);
        tooltip += text.replace(/\n/g, '<br/>');
      }

      tooltip += "</small>";

      list.push({
        annotation: options.annotation,
        min: options.time,
        max: options.time,
        eventType: options.annotation.name,
        title: null,
        description: tooltip,
        score: 1
      });
    }

    // Now init
    this.init();
  });

});
