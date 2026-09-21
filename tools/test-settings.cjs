const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readdirSync(path.join(root, 'src/scripts/app')).filter(name => name.endsWith('.js')).map(name => fs.readFileSync(path.join(root, 'src/scripts/app', name), 'utf8')).join('\n');
const functionSource = name => {
    const match = source.match(new RegExp(`^(?:  )?(?:async )?function ${name}\\([^]*?^  }`, 'm'));
    assert.ok(match, `Missing production function ${name}`);
    return match[0];
};
const defaults = source.match(/^  const defaultSettings = \{[^]*?^  };/m)[0];
const logTypes = source.match(/^  const LOG_SETTING_BY_TYPE = \{[^]*?^  };/m)[0];
const settingsKey = source.match(/const SETTINGS_KEY = ("[^"]+")/)[1];
const context = vm.createContext({console});
const functions = ['isPlainObject', 'validationError', 'validationResult', 'exactObjectFieldValidationErrors', 'requiredExactFieldsValidationErrors', 'validationErrorsText', 'exactLeftPanelGroup', 'exactComposerMode', 'preferenceSettingKeys', 'localSettingKeys', 'validateStoredSettings', 'defaultStoredSettings', 'localSettingsForStorage', 'loadStandaloneSettings', 'hydrateRuntimeSettingsFromExactStoredSettings', 'preferredRuntimeCharacterGenders', 'devInstallSmokeSettingsSandbox'];
vm.runInContext(`
const clone = value => JSON.parse(JSON.stringify(value));
const SUPABASE_PROJECT_URL = "", SUPABASE_PUBLISHABLE_KEY = "";
const DEFAULT_VOICE_BLACKLIST = [], DEFAULT_VOICE_GENDER_MAP = {};
const PERCHANCE_IMAGE_MODEL_DEFAULT = "test-style", PROFILE_IMAGE_MODEL_DEFAULT = "test-portrait-style";
const BODY_SCALE_SCHEMA_VERSION = 2, MAX_USER_PROFILES = 100;
const EMBERADVENTURES_DEBUG_ALL_LOGS = false;
const currentLaunchTextProvider = () => "perchance";
const SETTINGS_KEY = ${settingsKey};
${defaults}
${logTypes}
const LOG_SETTING_IDS = Object.values(LOG_SETTING_BY_TYPE);
const app = {settings: clone(defaultSettings)};
${functions.map(functionSource).join('\n')}
globalThis.subject = {app, SETTINGS_KEY, defaultSettings, preferenceSettingKeys, localSettingKeys, validateStoredSettings, defaultStoredSettings, localSettingsForStorage, loadStandaloneSettings, hydrateRuntimeSettingsFromExactStoredSettings, preferredRuntimeCharacterGenders, devInstallSmokeSettingsSandbox};
`, context);
const subject = context.subject;
const copy = value => JSON.parse(JSON.stringify(value));
(async () => {
    subject.app.library = {
        listSettings: async () => ({'emberadventures-lite-settings': {obsolete: true}}),
        listProfiles: async () => {throw new Error('Previous profiles must not be read');},
        putSettings: async () => {throw new Error('Loading must not change settings');}
    };
    const fresh = await subject.loadStandaloneSettings();
    assert.equal(subject.validateStoredSettings(fresh).ok, true);
    assert.equal(subject.validateStoredSettings({...copy(fresh), unknownPreference: 1}).ok, false);
    subject.app.settings = subject.hydrateRuntimeSettingsFromExactStoredSettings(fresh);
    subject.app.settings.preferredCharacterGender = 'female';
    assert.equal(subject.preferredRuntimeCharacterGenders()[0], 'female');
    assert.equal(subject.defaultSettings.devMode, true);
    assert.equal(subject.hydrateRuntimeSettingsFromExactStoredSettings({...copy(fresh), devMode: false}).devMode, true);
    const saved = {...copy(fresh), autoVoice: false};
    subject.app.library.listSettings = async () => ({[subject.SETTINGS_KEY]: saved});
    assert.equal((await subject.loadStandaloneSettings()).autoVoice, false);
    const realValues = {[subject.SETTINGS_KEY]: copy(fresh)};
    let realSettingsWrites = 0;
    subject.app.library = {
        listSettings: async () => copy(realValues),
        putSettings: async entries => {realSettingsWrites++; Object.assign(realValues, copy(entries));},
        deleteSettings: async keys => {for (const key of keys) delete realValues[key];}
    };
    const sandbox = subject.devInstallSmokeSettingsSandbox(fresh);
    await subject.app.library.putSettings({[subject.SETTINGS_KEY]: {...copy(fresh), autoVoice: false}, unrelatedTestKey: true});
    assert.equal(realSettingsWrites, 1);
    assert.equal(realValues[subject.SETTINGS_KEY].autoVoice, fresh.autoVoice);
    assert.equal((await subject.app.library.listSettings())[subject.SETTINGS_KEY].autoVoice, false);
    await subject.app.library.deleteSettings([subject.SETTINGS_KEY]);
    assert.equal(Object.hasOwn(await subject.app.library.listSettings(), subject.SETTINGS_KEY), false);
    assert.ok(realValues[subject.SETTINGS_KEY]);
    sandbox.restore();
    assert.deepEqual((await subject.app.library.listSettings())[subject.SETTINGS_KEY], copy(fresh));
    console.log('Settings checks passed: standalone defaults, strict validation, hydration, persistence, no startup writes, and smoke isolation.');
})().catch(error => {console.error(error); process.exitCode = 1;});
