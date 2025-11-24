// ==UserScript==
// @name         AMQ Romaji Dropdown Sort
// @namespace    https://github.com/curtain-calls/amqscript_romaji_sort
// @version      1.1
// @description  Make your AMQ dropdown answer show Romaji first (Fixed duplicates)
// @author       Lycee
// @match        https://animemusicquiz.com/*
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Lycee Bot] Script loaded');

    let dropdownList = [];
    let isInitialized = false;

    let romajiSet = new Set();
    let englishSet = new Set();
    let romajiCount = 0;

    function extractNamesFromCache(animeCache) {
        const romajiNames = new Set();
        const englishNames = new Set();

        // First pass: collect all JA and EN names separately
        for (const animeEntry of Object.values(animeCache)) {
            const names = animeEntry.names;
            if (!names?.length) continue;

            for (const nameObj of names) {
                if (!nameObj.name) continue;

                if (nameObj.language === 'JA') {
                    romajiNames.add(nameObj.name);
                } else if (nameObj.language === 'EN') {
                    englishNames.add(nameObj.name);
                }
            }
        }

        // Second pass: Promote English titles if they're prefixes of Romaji titles
        const promoted = new Set();
        for (const enTitle of englishNames) {
            for (const jaTitle of romajiNames) {
                // Check if any Romaji title starts with this English title
                if (jaTitle.startsWith(enTitle + ':') ||
                    jaTitle.startsWith(enTitle + ' ')) {
                    promoted.add(enTitle);
                    break;
                }
            }
        }

        // Remove promoted titles from English and add to Romaji
        for (const title of promoted) {
            englishNames.delete(title);
            romajiNames.add(title);
        }

        // CRITICAL FIX: Remove any titles that appear in both sets
        // This prevents duplicates from promotion or cache inconsistencies
        for (const title of romajiNames) {
            englishNames.delete(title);
        }

        romajiSet = romajiNames;
        englishSet = englishNames;
        romajiCount = romajiNames.size;

        // CRITICAL FIX: Use Set to ensure no duplicates in final list
        const combinedSet = new Set([...romajiNames, ...englishNames]);
        dropdownList = [...combinedSet];

        console.log(`[Lycee Bot] Ready: ${dropdownList.length} titles loaded`);

        forceUpdateAutoComplete();
    }

    function forceUpdateAutoComplete(retryCount = 0) {
        if (typeof quiz !== 'undefined' &&
            quiz.answerInput?.typingInput?.autoCompleteController) {
            const controller = quiz.answerInput.typingInput.autoCompleteController;
            controller.list = dropdownList;
            controller.newList();

            if (controller.awesomepleteInstance) {
                const instance = controller.awesomepleteInstance;
                instance._romajiSet = new Set(romajiSet);

                instance.sort = function(a, b) {
                    const romaji = instance._romajiSet;
                    const aStr = String(a);
                    const bStr = String(b);

                    const aIsRomaji = romaji.has(aStr);
                    const bIsRomaji = romaji.has(bStr);

                    // Romaji always comes first
                    if (aIsRomaji && !bIsRomaji) return -1;
                    if (!aIsRomaji && bIsRomaji) return 1;

                    // Within same group, use AMQ's original sort (length → alphabetical)
                    return aStr.length !== bStr.length
                        ? aStr.length - bStr.length
                        : aStr < bStr ? -1 : 1;
                };

                instance.list = dropdownList;
                instance._list = dropdownList;
                instance.evaluate();
            }

            return;
        }

        if (retryCount === 0) {
            if (typeof Listener !== 'undefined') {
                new Listener("quiz ready", () => {
                    setTimeout(() => {
                        if (quiz.answerInput?.typingInput?.autoCompleteController) {
                            const controller = quiz.answerInput.typingInput.autoCompleteController;
                            controller.list = dropdownList;
                            controller.newList();

                            if (controller.awesomepleteInstance) {
                                const instance = controller.awesomepleteInstance;
                                instance._romajiSet = new Set(romajiSet);

                                instance.sort = function(a, b) {
                                    const romaji = instance._romajiSet;
                                    const aStr = String(a);
                                    const bStr = String(b);

                                    const aIsRomaji = romaji.has(aStr);
                                    const bIsRomaji = romaji.has(bStr);

                                    // Romaji always comes first
                                    if (aIsRomaji && !bIsRomaji) return -1;
                                    if (!aIsRomaji && bIsRomaji) return 1;

                                    // Within same group, use AMQ's original sort (length → alphabetical)
                                    return aStr.length !== bStr.length
                                        ? aStr.length - bStr.length
                                        : aStr < bStr ? -1 : 1;
                                };

                                instance.list = dropdownList;
                                instance._list = dropdownList;
                                instance.evaluate();
                            }
                        }
                    }, 100);
                }).bindListener();
            }
        }
    }

    function waitFor(checkFn, maxAttempts = 60, description = 'dependency') {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const interval = setInterval(() => {
                if (checkFn()) {
                    clearInterval(interval);
                    resolve();
                } else if (++attempts >= maxAttempts) {
                    clearInterval(interval);
                    reject(new Error(`Timeout waiting for ${description} (${maxAttempts * 250}ms)`));
                }
            }, 250);
        });
    }

    function hookAutoComplete() {
        const originalUpdateList = AutoCompleteController.prototype.updateList;

        AutoCompleteController.prototype.updateList = function() {
            if (dropdownList.length === 0) {
                originalUpdateList.call(this);
                return;
            }

            if (this.version === null) {
                const listener = new Listener("get all song names", (payload) => {
                    this.version = payload.version;
                    this.list = dropdownList;
                    this.newList();

                    if (this.awesomepleteInstance) {
                        const instance = this.awesomepleteInstance;
                        instance._romajiSet = new Set(romajiSet);

                        instance.sort = function(a, b) {
                            const romaji = instance._romajiSet;
                            const aStr = String(a);
                            const bStr = String(b);

                            const aIsRomaji = romaji.has(aStr);
                            const bIsRomaji = romaji.has(bStr);

                            // Romaji always comes first
                            if (aIsRomaji && !bIsRomaji) return -1;
                            if (!aIsRomaji && bIsRomaji) return 1;

                            // Within same group, use AMQ's original sort (length → alphabetical)
                            return aStr.length !== bStr.length
                                ? aStr.length - bStr.length
                                : aStr < bStr ? -1 : 1;
                        };

                        instance.list = dropdownList;
                        instance._list = dropdownList;
                    }

                    listener.unbindListener();
                });

                listener.bindListener();
                socket.sendCommand({ type: 'quiz', command: 'get all song names' });
            } else {
                const listener = new Listener("update all song names", (payload) => {
                    this.version = payload.version;

                    if (payload.deleted.length + payload.new.length > 0) {
                        this.list = dropdownList;
                        this.newList();

                        if (this.awesomepleteInstance) {
                            const instance = this.awesomepleteInstance;
                            instance._romajiSet = new Set(romajiSet);

                            instance.sort = function(a, b) {
                                const romaji = instance._romajiSet;
                                const aStr = String(a);
                                const bStr = String(b);

                                const aIsRomaji = romaji.has(aStr);
                                const bIsRomaji = romaji.has(bStr);

                                // Romaji always comes first
                                if (aIsRomaji && !bIsRomaji) return -1;
                                if (!aIsRomaji && bIsRomaji) return 1;

                                // Within same group, use AMQ's original sort (length → alphabetical)
                                return aStr.length !== bStr.length
                                    ? aStr.length - bStr.length
                                    : aStr < bStr ? -1 : 1;
                            };

                            instance.list = dropdownList;
                            instance._list = dropdownList;
                        }
                    }

                    listener.unbindListener();
                });

                listener.bindListener();
                socket.sendCommand({
                    type: 'quiz',
                    command: 'update all song names',
                    data: { currentVersion: this.version }
                });
            }
        };
    }

    async function initialize() {
        if (isInitialized) return;

        try {
            console.log('[Lycee Bot] Initializing...');

            await waitFor(() => typeof libraryCacheHandler !== 'undefined', 60, 'libraryCacheHandler');
            await waitFor(() => typeof AutoCompleteController !== 'undefined', 60, 'AutoCompleteController');
            await waitFor(() => typeof Listener !== 'undefined', 60, 'Listener');
            await waitFor(() => typeof socket !== 'undefined', 60, 'socket');

            hookAutoComplete();

            libraryCacheHandler.getCache((animeCache) => {
                if (!animeCache || Object.keys(animeCache).length === 0) {
                    setTimeout(() => libraryCacheHandler.getCache(extractNamesFromCache), 2000);
                    return;
                }
                extractNamesFromCache(animeCache);
                isInitialized = true;
            });

        } catch (error) {
            console.error('[Lycee Bot] Initialization failed:', error);
            setTimeout(initialize, 5000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
