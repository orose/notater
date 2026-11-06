// PO-5: forståelig norsk feilmelding hvis Node er for gammel, før vite/tsx prøver å starte.
// Skrevet bevisst i gammeldags JavaScript uten import/export, slik at fila kan tolkes også av
// svært gamle Node-versjoner (ellers får brukeren en syntaksfeil i stedet for denne meldingen).
// Minstekravet må stemme med «engines» i package.json (sjekkes av check-node.test.ts).
var MINIMUM = [22, 22, 0];

function parse(version) {
  return String(version)
    .replace(/^v/, '')
    .split('.')
    .map(function (part) {
      return parseInt(part, 10) || 0;
    });
}

function isAtLeast(actual, minimum) {
  for (var i = 0; i < minimum.length; i++) {
    var a = actual[i] || 0;
    if (a !== minimum[i]) return a > minimum[i];
  }
  return true;
}

var simulateIndex = process.argv.indexOf('--simulate');
var version = simulateIndex > -1 ? process.argv[simulateIndex + 1] : process.versions.node;

if (!isAtLeast(parse(version), MINIMUM)) {
  process.stderr.write(
    '\n' +
      '  Vault-leseren krever Node.js ' + MINIMUM[0] + '.' + MINIMUM[1] + ' eller nyere (du har ' + version + ').\n' +
      '\n' +
      '  Slik oppgraderer du:\n' +
      '    - Med nvm:  nvm install && nvm use   (leser .nvmrc i prosjektmappa)\n' +
      '    - Ellers:   last ned Node 22 LTS eller 24 LTS fra https://nodejs.org\n' +
      '\n' +
      '  Kjør deretter npm ci på nytt før npm start.\n\n',
  );
  process.exit(1);
}
