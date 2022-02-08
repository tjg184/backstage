/*
 * Copyright 2021 Larder Software Limited
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

import { createTemplateAction } from '@backstage/plugin-scaffolder-backend';
import { Config } from '@backstage/config';
import path from 'path'
import AdmZip from "adm-zip"

export function createZipAction(options: { config: Config }) {
    const { config } = options;
    return createTemplateAction<{ path: string }>({
        id: "roadiehq:utils:zip",
        description: "Zips the content of the path",
        schema: {
            input: {
                type: 'object',
                properties: {
                    path: {
                        title: 'Path',
                        description: 'Relative path you would like to zip',
                        type: 'string',
                    },
                }
            },
            output: {
                type: 'object',
                properties: {
                    path: {
                        title: 'Zip Path',
                        type: 'string'
                    }
                }
            }
        },
        async handler(ctx) {
            const zip = new AdmZip()
            ctx.logger.info(ctx.workspacePath)
            zip.addLocalFolder(ctx.workspacePath)
            ctx.logger.info(zip.getEntries())

            const resultPath = path.join(ctx.workspacePath, ctx.input.path)
            zip.writeZip(resultPath)
            ctx.logger.info(resultPath)
            ctx.output('path', resultPath)
        }
    })
}