import { useEffect, useState } from 'react';
import { useHistoryQuery } from '../api/queries';
import { formatTime } from './format';
import { Pagination } from './Pagination';
import { QueryView } from './QueryView';

const END_REASON_LABEL = { time: "Time's up", death: 'Sunk' } as const;

export function HistoryTab({ playerId }: { playerId: string }) {
  const [page, setPage] = useState(1);
  const query = useHistoryQuery(playerId, page);
  const totalPages = query.data?.totalPages ?? 0;

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div>
      <QueryView
        query={query}
        subject="your match history"
        emptyMessage="You have no saved matches yet. Finish a match to see it here."
      >
        {(data) => (
          <table className="data-table">
            <caption className="visually-hidden">Your matches, page {data.page}</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Score</th>
                <th scope="col">Played</th>
                <th scope="col">End</th>
                <th scope="col">Settings</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((match) => (
                <tr key={match.matchId}>
                  <td>
                    {new Date(match.endedAt).toLocaleString(undefined, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td>{match.score}</td>
                  <td>{formatTime(match.duration)}</td>
                  <td>{END_REASON_LABEL[match.endReason]}</td>
                  <td>
                    {match.settings.matchDuration} s · {match.settings.spawnInterval} s
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </QueryView>
      <Pagination
        label="Match history pages"
        page={page}
        totalPages={totalPages}
        isLoadingPage={query.isPlaceholderData}
        onChange={setPage}
      />
    </div>
  );
}
