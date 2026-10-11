#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { readConfig } from '../lib/config';
import { buildApp } from '../lib/app';
const app = new App(); buildApp(app, readConfig(app));
