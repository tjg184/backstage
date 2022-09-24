/*
 * Copyright 2022 Larder Software Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { GroupEntity } from '@backstage/catalog-model';
import * as winston from 'winston';
import { Config } from '@backstage/config';
import { OktaEntityProvider } from './OktaEntityProvider';
import {
  GroupNamingStrategies,
  GroupNamingStrategy,
  groupNamingStrategyFactory,
} from './groupNamingStrategyFactory';
import {
  UserNamingStrategies,
  UserNamingStrategy,
  userNamingStrategyFactory,
} from './userNamingStrategyFactory';
import { Client } from '@okta/okta-sdk-nodejs';

/**
 * Provides entities from Okta Group service.
 */
export class OktaGroupEntityProvider extends OktaEntityProvider {
  private readonly namingStrategy: GroupNamingStrategy;
  private readonly userNamingStrategy: UserNamingStrategy;
  private readonly groups: string[] | undefined;

  static fromConfig(
    config: Config,
    options: {
      logger: winston.Logger;
      namingStrategy?: GroupNamingStrategies;
      userNamingStrategy?: UserNamingStrategies;
    },
  ) {
    const orgUrl = config.getString('orgUrl');
    const token = config.getString('token');
    const groups = config.getOptionalStringArray("groups")

    return new OktaGroupEntityProvider({ orgUrl, token }, options, groups);
  }

  constructor(
    accountConfig: any,
    options: {
      logger: winston.Logger;
      namingStrategy?: GroupNamingStrategies;
      userNamingStrategy?: UserNamingStrategies;
    },
    groups: string[] | undefined
  ) {
    super(accountConfig, options);
    this.namingStrategy = groupNamingStrategyFactory(options.namingStrategy);
    this.userNamingStrategy = userNamingStrategyFactory(
      options.userNamingStrategy,
    );
    this.groups = groups;
  }

  getProviderName(): string {
    return `okta-group-${this.orgUrl}`;
  }

  async run(): Promise<void> {
    if (!this.connection) {
      throw new Error('Not initialized');
    }

    this.logger.info(
      `Providing okta group resources from okta: ${this.orgUrl}`,
    );

    const client = this.getClient();
    const defaultAnnotations = await this.buildDefaultAnnotations();

    const groupResources: GroupEntity[] = [];

    if (this.groups) {
      for (const group of this.groups) {
        await this.listGroups(client, defaultAnnotations, groupResources, group);
      }
    }
    else {
      await this.listGroups(client, defaultAnnotations, groupResources);
    }

    await this.connection.applyMutation({
      type: 'full',
      entities: groupResources.map(entity => ({
        entity,
        locationKey: this.getProviderName(),
      })),
    });
  }

  private async listGroups(
    client: Client, 
    defaultAnnotations: Record<string, string> | undefined, 
    groupResources: GroupEntity[], 
    group: string | undefined = undefined) {

    const queryParameters = group ? { q: group } : {}

    await client.listGroups(queryParameters).each(async (group) => {
      const members: string[] = [];

      await group.listUsers().each(user => {
        members.push(this.userNamingStrategy(user));
      });
      const groupEntity: GroupEntity = {
        kind: 'Group',
        apiVersion: 'backstage.io/v1alpha1',
        metadata: {
          annotations: {
            ...defaultAnnotations,
          },
          name: this.namingStrategy(group),
          title: group.profile.name,
          description: group.profile.description,
        },
        spec: {
          members,
          type: 'group',
          children: [],
        },
      };

      groupResources.push(groupEntity);
    });
  }
}
