import { useEffect, useState } from 'react';
import type { MatchSettings } from '../api/contracts';
import { useRankingQuery } from '../api/queries';
import { formatTime } from './format';
import { Pagination } from './Pagination';
import { QueryView } from './QueryView';

interface RankingTabProps {
  /** Only matches played with these settings are ranked together. */
  settings: MatchSettings;
  playerId: string;
}

export function RankingTab({ settings, playerId }: RankingTabProps) {
  const [page, setPage] = useState(1);
  const query = useRankingQuery(settings, page);
  const totalPages = query.data?.totalPages ?? 0;

  // If the list shrank (e.g. data reset), go back to the last page that exists.
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div>
      <p className="muted">
        Matches of {settings.matchDuration} s with a new enemy every {settings.spawnInterval} s.
        Change the settings in Options to see other rankings.
      </p>
      <QueryView query={query} subject="the ranking" emptyMessage="No matches with these settings yet. Be the first!">
        {(data) => (
          <table className="data-table">
            <caption className="visually-hidden">Ranking, page {data.page}</caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Player</th>
                <th scope="col">Score</th>
                <th scope="col">Time</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((entry) => {
                const isYou = entry.playerId === playerId;
                return (
                  <tr key={entry.matchId} className={isYou ? 'is-you' : undefined}>
                    <td>{entry.rank}</td>
                    <td>
                      {entry.playerName}
                      {isYou && <strong> (you)</strong>}
                    </td>
                    <td>{entry.score}</td>
                    <td>{formatTime(entry.duration)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </QueryView>
      <Pagination
        label="Ranking pages"
        page={page}
        totalPages={totalPages}
        isLoadingPage={query.isPlaceholderData}
        onChange={setPage}
      />
    </div>
  );
}
