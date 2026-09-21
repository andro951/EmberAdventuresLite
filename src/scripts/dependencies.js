
    try {
        (window.root || window).loadDependencies?.();
    } catch (err) {
        console.error("EmberAdventures dependency load failed", err);
    }
