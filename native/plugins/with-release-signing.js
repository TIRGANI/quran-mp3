// Signe l'APK de production avec la clé historique de Wirdan, pour que la nouvelle application
// remplace l'ancienne (même identifiant + même signature = mise à jour sans désinstaller).
// La clé reste HORS du dépôt : ~/Documents/coranmp3-signature/keystore.properties.
// Sans ce fichier, rien ne change (signature de débogage par défaut).
const { withAppBuildGradle } = require('expo/config-plugins');

const MARK = '// wirdan-release-signing';

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, cfg => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes(MARK)) return cfg;
    // 1. Configuration de signature « release » lue depuis keystore.properties
    gradle = gradle.replace(
      /signingConfigs\s*\{/,
      `signingConfigs {
        ${MARK}
        release {
            def keyFile = new File(System.getProperty("user.home"), "Documents/coranmp3-signature/keystore.properties")
            if (keyFile.exists()) {
                def keyProps = new Properties()
                keyFile.withInputStream { keyProps.load(it) }
                storeFile file(keyProps["storeFile"])
                storePassword keyProps["storePassword"]
                keyAlias keyProps["keyAlias"]
                keyPassword keyProps["keyPassword"]
            }
        }`,
    );
    // 2. Le type de build « release » l'utilise quand la clé est présente
    gradle = gradle.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      `$1signingConfig new File(System.getProperty("user.home"), "Documents/coranmp3-signature/keystore.properties").exists() ? signingConfigs.release : signingConfigs.debug`,
    );
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
