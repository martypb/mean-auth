'use strict';

angular.module('authentication', [])

.factory('Auth', ['$log','$location','$cookies','$http','$q','$config', function($log, $location, $cookies, $http, $q, $config) {
	//used for decoding the jwt returned during authentication
	function url_base64_decode(str) {
		var output = str.replace('-','+').replace('_','/');
		switch(output.length % 4) {
			case 0:
				break;
			case 2:
				output += '==';
				break;
			case 3:
				output += '=';
				break;
			default:
				throw 'Illegal base64 url string!';
		}

		return window.atob(output);
	}

	function getDecodedUser() {
		return ($cookies.token !== undefined) ? JSON.parse(url_base64_decode($cookies.token.split('.')[1])) : null;
	}

	return {
		isAuthenticated: function() {
			var user = getDecodedUser();

			if(user) {
				var now = new Date();
				var expiration = new Date(user.exp * 1000); //convert unix timestamp to milliseconds
				var isExpired = (expiration.getTime() <= now.getTime()) ? true : false;
				$log.debug(expiration, now);

				return (isExpired) ? false : true;
			}

			return false;
		},
		login: function(user) {
			var defer = $q.defer();

			$http.post($config.server+'/login', user).then(function(response) {
				if(response.data.error) {
					$log.error('Login Error:', response);
					defer.reject(response.data.error);
				} else {
					$cookies.token = response.data;
					$location.path('/');
					defer.resolve(getDecodedUser());
				}
			}, function(error) {
				$log.error('Login Error:', error);
				defer.reject(error);
			});

			return defer.promise;
		},
		logout: function() {
			var defer = $q.defer();

			$http.get($config.server+'/logout').then(function(response) {

				$location.path('/login');
				defer.resolve(response);

			}, function(error) {
				$log.error('Logout Error:', error);
				defer.reject(error);
			});

			return defer.promise;
		}
	};
}])

.factory('AuthInterceptor', ['$q','$cookies','$location', function($q, $cookies, $location) {
	return {
		request: function(config) {
			if(!config) config = {};
			config.headers = config.headers || {};

			if($cookies.token !== undefined) {
				config.headers.Authorization = 'Bearer ' + $cookies.token;
			}

			return config;
		},
		response: function(response) {
			if(response.status === 401) {
				$location.path('/login');
			}

			return response || $q.when(response);
		}
	};
}])

.controller('LoginController', ['$scope','$log','$timeout','$window','Auth', function($scope, $log, $timeout, $window, Auth) {

	$scope.user = {
		email: 'jonnybro@gmail.com',
		password: '1234'
	};

	$scope.loginWith = [
		{
			name: 'Google',
			url: '/auth/google'
		},
		{
			name: 'Github',
			url: '/auth/github'
		},
		{
			name: 'Salesforce',
			url: '/auth/salesforce'
		}
	];

	$scope.login = function() {
		Auth.login($scope.user).then(function() {
			$log.debug('Authenticated:', Auth.isAuthenticated());
			//TODO: display error message on invalid login
		}, function(error) {
			$scope.error = {
				type: 'danger',
				message: error.data.message || error.data
			};
		});
	};
}])

.config(['$httpProvider', function($httpProvider) {
	$httpProvider.interceptors.push('AuthInterceptor');
}])

.run(['$rootScope','Auth','$location', function($rootScope, Auth, $location) {
	//verify the user is authenticated when the user changes routes
    $rootScope.$on('$routeChangeStart', function(event, next, current) {
        //change route to login if user isnt authenticated
        if(!Auth.isAuthenticated()) $location.path('/login');
    });
}])

;