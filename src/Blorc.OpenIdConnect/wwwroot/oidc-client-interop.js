﻿window.BlorcOidc = {
    Navigation: {
        IsRedirected: function () {
            return performance.getEntriesByType("navigation")[0].type === "navigate";
        }
    },
    Client: {
        UserManager: {
            IsInitialized: function() {
                return this.userManager !== undefined;
            },
            Initialize: function (config, userManagerHelper) {
                if (this.userManager !== undefined) {
                    return;
                }

                if (config.automaticSilentRenew && (config.silent_redirect_uri === null || config.silent_redirect_uri === "")) {
                    config.silent_redirect_uri = window.location.protocol + "//" + window.location.hostname;
                    let port = Number(window.location.port);
                    let portsToIgnore = [NaN, 0, 80, 443];
                    if (!portsToIgnore.includes(port)) {
                        config.silent_redirect_uri += ":" + port;
                    }

                    config.silent_redirect_uri += "/_content/Blorc.OpenIdConnect/silent-refresh.html";
                }

                let self = this;

                if (config.timeForUserInactivityAutomaticLogout > 0) {
                    var userInactivityLogoutTimer = setTimeout(trySignoutRedirect, config.timeForUserInactivityAutomaticLogout);

                    var userInactivityTimer;
                    if (config.timeForUserInactivityNotification > 0) {
                        userInactivityTimer = setTimeout(notifyUserInactivity, config.timeForUserInactivityNotification);
                    }

                    document.addEventListener('mousemove', function (event) { resetInactivityTimers(); });
                    document.addEventListener('keypress', function (event) { resetInactivityTimers(); });

                    var notifiedByUserInactivity = false;

                    function resetInactivityTimers() {
                        clearTimeout(userInactivityLogoutTimer);
                        userInactivityLogoutTimer = setTimeout(trySignoutRedirect, config.timeForUserInactivityAutomaticLogout);

                        if (config.timeForUserInactivityNotification > 0) {
                            clearTimeout(userInactivityTimer);
                            userInactivityTimer = setTimeout(notifyUserInactivity, config.timeForUserInactivityNotification);
                        }

                        if (notifiedByUserInactivity) {
                            notifiedByUserInactivity = false;
                            userManagerHelper.invokeMethodAsync('OnUserActivity');
                        }
                    }

                    function notifyUserInactivity() {
                        if (self.userManager === undefined) {
                            return;
                        }

                        self.userManager.getUser().then(function (u) {
                            if (u !== null) {
                                if (config.timeForUserInactivityNotification > 0) {
                                    userInactivityTimer = setTimeout(notifyUserInactivity, config.timeForUserInactivityNotification);
                                }

                                notifiedByUserInactivity = true;
                                userManagerHelper.invokeMethodAsync('OnUserInactivity');
                            }
                        });
                    }

                    function trySignoutRedirect() {
                        if (self.userManager === undefined) {
                            return;
                        }

                        self.userManager.getUser().then(function (u) {
                            if (u !== null) {
                                self.userManager.signoutRedirect();
                            }
                        });
                    }
                }

                this.userManager = new oidc.UserManager(config);

                if (config.automaticSilentRenew) {
                    this.userManager.events.addAccessTokenExpiring(function() {
                        self.userManager.signinSilent({ scope: config.scope, response_type: config.response_type })
                            .then(function(u) {
                                self.SetCurrentUser(u);
                            })
                            .catch(function(e) {
                                console.log(e);
                            });
                    });
                }
            },
            IsAuthenticated: function() {
                if (this.userManager === undefined) {
                    return false;
                }

                if (this.User !== undefined) {
                    return true;
                }

                let self = this;
                return new Promise((resolve, _reject) => {
                    self.userManager.signinRedirectCallback().then(function(u) {
                        resolve(u !== null);
                    }).catch(function(e) {
                        if (e.message !== "No state in response") {
                            console.log(e);
                        }

                        self.userManager.getUser().then(function(u) {
                            resolve(u != null);
                        });
                    });
                });
            },
            GetUser: function() {
                if (this.userManager === undefined) {
                    return null;
                }

                if (this.User !== undefined) {
                    return this.User;
                }

                let self = this;
                return new Promise((resolve, _reject) => {
                    self.userManager.getUser().then(function(u) {
                        self.SetCurrentUser(u);
                        resolve(u);
                    }).catch(function(e) {
                        if (e.message !== "No state in response") {
                            console.log(e);
                        }

                        resolve(null);
                    });
                });
            },
            SigninRedirect: function() {
                if (this.userManager === undefined) {
                    return false;
                }

                let self = this;
                return new Promise((resolve, _reject) => {
                    self.userManager.signinRedirect();
                    resolve(true);
                });
            },
            SignoutRedirect: function() {
                this.User = undefined;
                if (this.userManager === undefined) {
                    return false;
                }

                let self = this;
                return new Promise((resolve, _reject) => {
                    self.userManager.signoutRedirect();
                    resolve(true);
                });
            },
            SetCurrentUser: function(u) {
                this.User = u;
            }
        }
    }
}