import BotMarketplace from './BotMarketplace';

export default function DiscoverMarketplace({ onInstalled }) {
  return <BotMarketplace onInstalled={onInstalled} compact showPageLink />;
}