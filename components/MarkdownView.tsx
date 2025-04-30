import React, { useState } from 'react';
import '@mdxeditor/editor/style.css';
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkDialogPlugin,
  imagePlugin,
  tablePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin
} from '@mdxeditor/editor';

type Props = {
  content: string;
  readOnly?: boolean;
};

const MarkdownView: React.FC<Props> = ({ content, readOnly = true }) => {
  return (
    <div className="markdown-container p-4 bg-white rounded shadow">
      <MDXEditor
        markdown={content}
        readOnly={readOnly}
        contentEditableClassName="prose max-w-none"
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          markdownShortcutPlugin(),
          linkDialogPlugin(),
          imagePlugin(),
          tablePlugin(),
          codeBlockPlugin(),
          codeMirrorPlugin(),
          diffSourcePlugin(),
        ]}
      />
    </div>
  );
};

export default MarkdownView;