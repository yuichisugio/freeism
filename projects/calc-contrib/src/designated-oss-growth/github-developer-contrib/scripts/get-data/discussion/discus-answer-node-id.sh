#!/bin/bash

#--------------------------------------
# discussionのnode_idの結果から、answer.idをnode_idとして抽出し、reactions.totalCountとreplies.totalCountを保持した中間ファイルを作成するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# discussionのnode_idの結果から、answer.idをnode_idとして抽出し、reactions.totalCountとreplies.totalCountを保持した中間ファイルを作成する関数
# get_paginated_data_by_node_idには、.でネストに対応していないため、データの抽出が必要
#--------------------------------------
function get_discussion_answer_node_id() {

  jq '
    [
      .[] 
      | select(.answer.id != null) 
      | {
          id: .answer.id, 
          databaseId: .answer.databaseId,
          url: .answer.url,
          upvoteCount: .answer.upvoteCount,
          author: .answer.author,
          bodyText: .answer.bodyText,
          publishedAt: .answer.publishedAt, # answerの作成日。task_dateで使用
          node_publishedAt: .publishedAt, # discussion自体の作成日。task_startで使用
          reactionGroups: .answer.reactionGroups,
          reactions: (.answer.reactions // {totalCount: 0}),
          replies: (.answer.replies // {totalCount: 0})
        }
    ]' \
    "$RESULT_GET_DISCUSSION_NODE_ID_PATH" >"$RESULT_GET_DISCUSSION_ANSWER_NODE_ID_PATH"

  return 0
}
