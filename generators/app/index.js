'use strict';

const askName   = require('inquirer-npm-name');
const { join }  = require('path');
const Generator = require('yeoman-generator');
const { merge } = require('./utils');

module.exports = class extends Generator {
  initializing() {
    this.props = {};
  }

  paths() {
    this.sourceRoot(join(__dirname, '../../'));
  }

  prompting() {
    return askName({
      name   : 'name',
      message: 'Your Web App name',
      default: 'webapp-example'
    }, this).then(nameAnswers => {
      return this.prompt([{
        name   : 'enableStickySession',
        message: '(Azure Web App) Enable sticky session',
        default: true,
        type   : 'boolean'
      }, {
        name   : 'use64BitWorkerProcess',
        message: '(Azure Web App) Enable 64-bit worker process',
        default: false,
        type   : 'boolean'
      }]).then(otherAnswers => {
        this.props.name = nameAnswers.name;
        this.props.enableStickySession = otherAnswers.enableStickySession;
        this.props.use64BitWorkerProcess = otherAnswers.use64BitWorkerProcess;

        this.destinationRoot(join(this.props.name, '/'));
      })
    });
  }

  writing() {
    ['*.js', '*.md'].forEach(filename => {
      this.fs.copy(
        this.templatePath(filename),
        this.destinationPath()
      );
    });

    ['iisnode.yml', 'web.config', 'doc', 'lib', 'public', 'scripts'].forEach(filename => {
      this.fs.copy(
        this.templatePath(filename),
        this.destinationPath(filename)
      );
    });

    const azureDeployJSON = this.fs.readJSON(this.templatePath('azuredeploy.json'));

    azureDeployJSON.resources
      .find(resource => resource.type === 'Microsoft.Web/sites')
      .properties.clientAffinityEnabled = this.props.enableStickySession;

    azureDeployJSON.resources
      .find(resource => resource.type === 'Microsoft.Web/sites')
      .resources
        .find(resource => resource.type === 'config' && resource.name === 'web')
        .properties.use32BitWorkerProcess = !this.props.use64BitWorkerProcess;

    this.fs.writeJSON(
      this.destinationPath('azuredeploy.json'),
      azureDeployJSON
    );

    this.fs.write(this.destinationPath('.gitignore'), ['dist', '**/node_modules', 'npm*.log*', '*.PublishSettings'].join('\n'));

    const generatorPackageJSON = this.fs.readJSON(this.templatePath('package.json'));
    const overridePackageJSON = this.fs.readJSON(this.templatePath('generators/app/overridePackage.json'));
    const rootPackageJSON = merge(generatorPackageJSON, overridePackageJSON);

    rootPackageJSON.description = rootPackageJSON.description
      .replace(/\$\{\s*packageName\s*\}/g, generatorPackageJSON.name)
      .replace(/\$\{\s*version\s*\}/g, generatorPackageJSON.version);

    rootPackageJSON.name = this.props.name;

    this.fs.writeJSON(this.destinationPath('package.json'), rootPackageJSON);

    const libPackageJSON = this.fs.readJSON(this.templatePath('lib/package.json'));

    libPackageJSON.description = rootPackageJSON.description;
    libPackageJSON.name = `${ this.props.name }-server`;

    this.fs.writeJSON(this.destinationPath('lib/package.json'), libPackageJSON);
  }

  install() {
    this.npmInstall([], { 'ignore-scripts': true });
  }
};
